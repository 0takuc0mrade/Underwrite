mod livenet_common;

use livenet_common::{
    gas_limit, load_settlement, read_agent_report_from, submit_claim,
    DEFAULT_STALE_ATTESTATION_PATH,
};
use odra::host::HostEnv;

fn main() {
    let env: HostEnv = odra_casper_livenet_env::env();
    env.set_gas(gas_limit());

    let mut settlement = load_settlement(&env);
    let claim = read_agent_report_from(
        "UNDERWRITE_STALE_ATTESTATION_PATH",
        DEFAULT_STALE_ATTESTATION_PATH,
    )
    .claim_attestation;

    submit_claim(&mut settlement, claim.clone());

    println!("StaleClaimStatus: submitted");
    println!("ExpectedContractResult: StaleClaim or ExpiredClaim rejection");
    println!("ClaimId: {}", claim.claim_id);
    println!("ObservedAt: {}", claim.observed_at);
    println!("ExpiresAt: {}", claim.expires_at);
}
