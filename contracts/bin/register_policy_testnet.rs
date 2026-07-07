mod livenet_common;

use livenet_common::{
    gas_limit, load_settlement, optional_u64, parse_address, parse_public_key, read_risk_fixture,
    required_value, DEFAULT_CURRENCY, DEFAULT_INSURED_VALUE_MINOR, DEFAULT_POLICY_ID,
};
use odra::host::HostEnv;
use std::env;

fn main() {
    let env: HostEnv = odra_casper_livenet_env::env();
    env.set_gas(gas_limit());

    let mut settlement = load_settlement(&env);
    let policy_id = env::var("UNDERWRITE_POLICY_ID").unwrap_or_else(|_| DEFAULT_POLICY_ID.into());
    let fixture = read_risk_fixture();
    let claimant_value = fixture
        .as_ref()
        .map(|fixture| fixture.claimant.clone())
        .unwrap_or_else(|| required_value("DEMO_CLAIMANT_ACCOUNT", "claimantAccount"));
    let claimant = parse_address("claimant", &claimant_value);
    let insured_value_minor = fixture
        .as_ref()
        .map(|fixture| fixture.insured_value_minor)
        .unwrap_or_else(|| {
            optional_u64(
                "UNDERWRITE_INSURED_VALUE_MINOR",
                "insuredValueMinor",
                DEFAULT_INSURED_VALUE_MINOR,
            )
        });
    let currency =
        env::var("UNDERWRITE_POLICY_CURRENCY").unwrap_or_else(|_| DEFAULT_CURRENCY.into());
    let oracle_public_key = parse_public_key(
        "UNDERWRITE_ORACLE_PUBLIC_KEY",
        &required_value("UNDERWRITE_ORACLE_PUBLIC_KEY", "oraclePublicKey"),
    )
    .to_hex_string();

    settlement.register_policy(
        policy_id.clone(),
        claimant,
        insured_value_minor,
        currency.clone(),
        oracle_public_key.clone(),
    );

    println!("PolicyRegistrationStatus: submitted");
    println!("PolicyId: {policy_id}");
    println!("Claimant: {}", claimant.to_string());
    println!("InsuredValueMinor: {insured_value_minor}");
    println!("Currency: {currency}");
    println!("OraclePublicKeyStored: {oracle_public_key}");
}
