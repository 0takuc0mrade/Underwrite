use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShipmentStatus {
    OnTime,
    Delayed,
    CriticalDelay,
    Lost,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimObservation {
    pub policy_number: String,
    pub claimant: String,
    pub tracking_id: String,
    pub carrier: String,
    pub origin_port: String,
    pub destination_port: String,
    pub status: ShipmentStatus,
    pub delay_hours: u64,
    pub insured_value_minor: u64,
    pub observed_at: u64,
    pub expires_at: u64,
    pub nonce: String,
    pub evidence_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedObservation {
    pub observation: ClaimObservation,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimAttestation {
    pub claim_id: String,
    pub policy_number: String,
    pub claimant: String,
    pub evidence_hash: String,
    pub status_code: u8,
    pub delay_hours: u64,
    pub payout_percentage: u8,
    pub payout_amount_minor: u64,
    pub observed_at: u64,
    pub expires_at: u64,
    pub public_key: String,
    pub claim_id_signature: String,
}

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("invalid oracle public key")]
    InvalidPublicKey,
    #[error("oracle signing key does not match signed observation public key")]
    OracleKeyMismatch,
    #[error("invalid oracle signature")]
    InvalidSignature,
    #[error("observation does not qualify")]
    NonQualifying,
}

pub fn canonical_observation(observation: &ClaimObservation) -> Vec<u8> {
    serde_json::to_vec(observation).expect("observation serialization cannot fail")
}

pub fn claim_id(observation: &ClaimObservation) -> String {
    hex::encode(Sha256::digest(canonical_observation(observation)))
}

pub fn payout_percentage(status: &ShipmentStatus, delay_hours: u64) -> u8 {
    if !matches!(status, ShipmentStatus::CriticalDelay | ShipmentStatus::Lost) {
        return 0;
    }
    match delay_hours {
        0..=47 => 0,
        48..=71 => 25,
        72..=119 => 50,
        120..=239 => 75,
        _ => 100,
    }
}

pub fn verify_and_attest(
    signed: &SignedObservation,
    oracle_signing_key: &SigningKey,
) -> Result<ClaimAttestation, AgentError> {
    let public_key_bytes: [u8; 32] = hex::decode(&signed.public_key)
        .map_err(|_| AgentError::InvalidPublicKey)?
        .try_into()
        .map_err(|_| AgentError::InvalidPublicKey)?;
    let public_key = VerifyingKey::from_bytes(&public_key_bytes)
        .map_err(|_| AgentError::InvalidPublicKey)?;
    if oracle_signing_key.verifying_key() != public_key {
        return Err(AgentError::OracleKeyMismatch);
    }
    let signature_bytes: [u8; 64] = hex::decode(&signed.signature)
        .map_err(|_| AgentError::InvalidSignature)?
        .try_into()
        .map_err(|_| AgentError::InvalidSignature)?;
    public_key
        .verify(
            &canonical_observation(&signed.observation),
            &Signature::from_bytes(&signature_bytes),
        )
        .map_err(|_| AgentError::InvalidSignature)?;

    let percentage = payout_percentage(
        &signed.observation.status,
        signed.observation.delay_hours,
    );
    if percentage == 0 {
        return Err(AgentError::NonQualifying);
    }

    let claim_id = claim_id(&signed.observation);
    let claim_id_signature = oracle_signing_key.sign(claim_id.as_bytes());
    Ok(ClaimAttestation {
        claim_id,
        policy_number: signed.observation.policy_number.clone(),
        claimant: signed.observation.claimant.clone(),
        evidence_hash: signed.observation.evidence_hash.clone(),
        status_code: match signed.observation.status {
            ShipmentStatus::OnTime => 0,
            ShipmentStatus::Delayed => 1,
            ShipmentStatus::CriticalDelay => 2,
            ShipmentStatus::Lost => 3,
        },
        delay_hours: signed.observation.delay_hours,
        payout_percentage: percentage,
        payout_amount_minor: signed.observation.insured_value_minor
            * u64::from(percentage)
            / 100,
        observed_at: signed.observation.observed_at,
        expires_at: signed.observation.expires_at,
        public_key: hex::encode(oracle_signing_key.verifying_key().as_bytes()),
        claim_id_signature: hex::encode(claim_id_signature.to_bytes()),
    })
}

pub fn sign_observation(
    observation: ClaimObservation,
    signing_key: &SigningKey,
) -> SignedObservation {
    let signature = signing_key.sign(&canonical_observation(&observation));
    SignedObservation {
        observation,
        public_key: hex::encode(signing_key.verifying_key().as_bytes()),
        signature: hex::encode(signature.to_bytes()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn observation(delay_hours: u64) -> ClaimObservation {
        ClaimObservation {
            policy_number: "MRC-CRG-2026-00481".to_string(),
            claimant:
                "account-hash-115d96efb1a8e35fbeea51e32bcbe158a9499d90255e36a6b1c370a90f21f8a1"
                    .to_string(),
            tracking_id: "MAEU-784239160".to_string(),
            carrier: "Maersk".to_string(),
            origin_port: "SGSIN".to_string(),
            destination_port: "NLRTM".to_string(),
            status: ShipmentStatus::CriticalDelay,
            delay_hours,
            insured_value_minor: 12_500_000,
            observed_at: 1_782_009_900,
            expires_at: 1_782_096_300,
            nonce: "obs_20260620_rotterdam_7f3a91".to_string(),
            evidence_hash:
                "67d12388c8e77cecf9f90432d2bc41ad9f8d55df0d33ffcd48ae8ee5cf6ad693"
                    .to_string(),
        }
    }

    #[test]
    fn verifies_and_builds_attestation() {
        let key = SigningKey::from_bytes(&[9; 32]);
        let signed = sign_observation(observation(75), &key);
        let attestation = verify_and_attest(&signed, &key).unwrap();
        assert_eq!(attestation.payout_percentage, 50);
        assert_eq!(attestation.payout_amount_minor, 6_250_000);
    }

    #[test]
    fn rejects_modified_evidence() {
        let key = SigningKey::from_bytes(&[9; 32]);
        let mut signed = sign_observation(observation(75), &key);
        signed.observation.delay_hours = 240;
        assert!(matches!(
            verify_and_attest(&signed, &key),
            Err(AgentError::InvalidSignature)
        ));
    }

    #[test]
    fn rejects_mismatched_oracle_key() {
        let key = SigningKey::from_bytes(&[9; 32]);
        let other_key = SigningKey::from_bytes(&[8; 32]);
        let signed = sign_observation(observation(75), &key);
        assert!(matches!(
            verify_and_attest(&signed, &other_key),
            Err(AgentError::OracleKeyMismatch)
        ));
    }
}
