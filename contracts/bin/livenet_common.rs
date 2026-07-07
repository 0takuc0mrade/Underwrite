#![allow(dead_code)]

use odra::{
    casper_types::{
        bytesrepr::Bytes,
        crypto::{AsymmetricType, PublicKey},
    },
    host::{HostEnv, HostRefLoader},
    prelude::*,
};
use serde::Deserialize;
use serde_json::Value;
use std::{env, fs, path::PathBuf, str::FromStr};
use underwrite_contracts::settlement::{UnderwriteSettlement, UnderwriteSettlementHostRef};

pub const DEFAULT_POLICY_ID: &str = "MRC-CRG-2026-00481";
pub const DEFAULT_INSURED_VALUE_MINOR: u64 = 12_500_000;
pub const DEFAULT_CURRENCY: &str = "USD";
pub const DEFAULT_SIGNED_RISK_ATTESTATION_PATH: &str =
    "fixtures/signed-risk-attestation.cargo-delay.json";
pub const DEFAULT_ATTESTATION_PATH: &str = "deployments/latest-attestation.json";
pub const DEFAULT_STALE_ATTESTATION_PATH: &str = "deployments/latest-stale-attestation.json";

#[derive(Debug, Deserialize)]
pub struct AgentReport {
    pub payout_percentage: u8,
    pub payout_amount_minor: u64,
    pub attestation_hash: String,
    pub claim_attestation: ClaimAttestation,
}

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Deserialize)]
pub struct RiskAttestationFixture {
    pub claimant: String,
    pub insured_value_minor: u64,
}

pub fn gas_limit() -> u64 {
    env::var("CASPER_DEPLOY_GAS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(300_000_000_000)
}

pub fn env_or_deployment(env_key: &str, deployment_key: &str) -> Option<String> {
    env::var(env_key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| deployment_value(deployment_key))
}

pub fn required_value(env_key: &str, deployment_key: &str) -> String {
    env_or_deployment(env_key, deployment_key).unwrap_or_else(|| {
        panic!(
            "missing {env_key}; set it in .env or provide {deployment_key} in deployments/casper-testnet.json"
        )
    })
}

pub fn optional_u64(env_key: &str, deployment_key: &str, fallback: u64) -> u64 {
    env_or_deployment(env_key, deployment_key)
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

pub fn load_settlement(env: &HostEnv) -> UnderwriteSettlementHostRef {
    let address = parse_address(
        "UNDERWRITE_CONTRACT_ADDRESS",
        &required_value("UNDERWRITE_CONTRACT_ADDRESS", "underwriteContract"),
    );
    UnderwriteSettlement::load(env, address)
}

pub fn parse_address(label: &str, value: &str) -> Address {
    let trimmed = value.trim();
    if let Ok(address) = Address::from_str(trimmed) {
        return address;
    }
    if let Ok(public_key) = PublicKey::from_hex(trimmed) {
        return Address::from(public_key);
    }
    panic!("failed to parse {label} as Casper/Odra address or public key hex")
}

pub fn parse_public_key(label: &str, value: &str) -> PublicKey {
    let trimmed = value.trim();
    if trimmed.len() == 64 {
        let bytes = hex::decode(trimmed)
            .unwrap_or_else(|error| panic!("failed to decode raw Ed25519 {label}: {error}"));
        return PublicKey::ed25519_from_bytes(bytes)
            .unwrap_or_else(|error| panic!("failed to parse raw Ed25519 {label}: {error}"));
    }

    PublicKey::from_hex(trimmed)
        .unwrap_or_else(|error| panic!("failed to parse Casper-formatted {label}: {error}"))
}

pub fn casper_signature_bytes(label: &str, raw_signature_hex: &str) -> Bytes {
    let mut bytes = hex::decode(raw_signature_hex.trim())
        .unwrap_or_else(|error| panic!("failed to decode {label}: {error}"));
    if bytes.len() == 64 {
        let mut tagged = Vec::with_capacity(65);
        tagged.push(1);
        tagged.extend(bytes);
        bytes = tagged;
    }
    Bytes::from(bytes)
}

pub fn read_agent_report() -> AgentReport {
    read_agent_report_from("UNDERWRITE_ATTESTATION_PATH", DEFAULT_ATTESTATION_PATH)
}

pub fn read_risk_fixture() -> Option<RiskAttestationFixture> {
    let path = env::var("UNDERWRITE_RISK_FIXTURE_PATH")
        .unwrap_or_else(|_| DEFAULT_SIGNED_RISK_ATTESTATION_PATH.to_string());
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn read_agent_report_from(env_key: &str, default_path: &str) -> AgentReport {
    let path = env::var(env_key).unwrap_or_else(|_| default_path.to_string());
    let text = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read attestation report {path}: {error}"));
    let start = text
        .find('{')
        .unwrap_or_else(|| panic!("attestation report {path} does not contain JSON"));
    serde_json::from_str(&text[start..])
        .unwrap_or_else(|error| panic!("failed to parse attestation report {path}: {error}"))
}

fn deployment_value(key: &str) -> Option<String> {
    let path = env::var("DEPLOYMENT_OUTPUT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("deployments/casper-testnet.json"));
    let text = fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&text).ok()?;
    match value.get(key)? {
        Value::String(value) if !value.trim().is_empty() => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

pub fn submit_claim(settlement: &mut UnderwriteSettlementHostRef, claim: ClaimAttestation) {
    let claimant = parse_address("claim_attestation.claimant", &claim.claimant);
    let public_key = parse_public_key("claim_attestation.public_key", &claim.public_key);
    let signature = casper_signature_bytes(
        "claim_attestation.claim_id_signature",
        &claim.claim_id_signature,
    );

    settlement.settle_claim(
        claim.claim_id,
        claim.policy_number,
        claimant,
        claim.evidence_hash,
        claim.status_code,
        claim.delay_hours,
        claim.payout_amount_minor,
        claim.observed_at,
        claim.expires_at,
        signature,
        public_key,
    );
}
