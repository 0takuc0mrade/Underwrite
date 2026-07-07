mod livenet_common;

use livenet_common::{gas_limit, load_settlement, read_agent_report, submit_claim};
use odra::host::HostEnv;

fn main() {
    let env: HostEnv = odra_casper_livenet_env::env();
    env.set_gas(gas_limit());

    let mut settlement = load_settlement(&env);
    let report = read_agent_report();
    let claim = report.claim_attestation;

    submit_claim(&mut settlement, claim.clone());

    println!("ValidClaimStatus: submitted");
    println!("ClaimId: {}", claim.claim_id);
    println!("PolicyId: {}", claim.policy_number);
    println!("AttestationHash: {}", report.attestation_hash);
    println!("PayoutPercentage: {}", report.payout_percentage);
    println!("PayoutAmountMinor: {}", report.payout_amount_minor);
}
