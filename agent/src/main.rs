use ed25519_dalek::SigningKey;
use std::{env, fs};
use underwrite_agent::{
    sign_observation, sign_risk_attestation, verify_and_attest, verify_risk_attestation,
    ClaimObservation, RiskAttestation, RiskAttestationPayload, SignedObservation,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let seed_hex = env::var("UNDERWRITE_ORACLE_SEED").unwrap_or_else(|_| {
        "0909090909090909090909090909090909090909090909090909090909090909".to_string()
    });
    let seed: [u8; 32] = hex::decode(seed_hex)?
        .try_into()
        .map_err(|_| "UNDERWRITE_ORACLE_SEED must contain exactly 32 bytes of hex")?;
    let signing_key = SigningKey::from_bytes(&seed);

    if args.get(1).is_some_and(|arg| arg == "sign") {
        let path = args
            .get(2)
            .cloned()
            .unwrap_or_else(|| "fixtures/observation.json".to_string());
        let observation: ClaimObservation = serde_json::from_slice(&fs::read(path)?)?;
        let signed = sign_observation(observation, &signing_key);
        println!("{}", serde_json::to_string_pretty(&signed)?);
        return Ok(());
    }

    if args.get(1).is_some_and(|arg| arg == "sign-risk") {
        let path = args
            .get(2)
            .cloned()
            .unwrap_or_else(|| "fixtures/risk-attestation.cargo-delay.payload.json".to_string());
        let payload: RiskAttestationPayload = serde_json::from_slice(&fs::read(path)?)?;
        let signed = sign_risk_attestation(payload, &signing_key);
        println!("{}", serde_json::to_string_pretty(&signed)?);
        return Ok(());
    }

    let path = args
        .get(1)
        .cloned()
        .unwrap_or_else(|| "fixtures/signed-observation.json".to_string());
    let bytes = fs::read(&path)?;
    let value: serde_json::Value = serde_json::from_slice(&bytes)?;

    if value.get("observation").is_some() {
        let signed: SignedObservation = serde_json::from_value(value)?;
        let attestation = verify_and_attest(&signed, &signing_key)?;
        println!("{}", serde_json::to_string_pretty(&attestation)?);
    } else {
        let signed: RiskAttestation = serde_json::from_value(value)?;
        let report = verify_risk_attestation(&signed, &signing_key)?;
        println!("{}", serde_json::to_string_pretty(&report)?);
    }
    Ok(())
}
