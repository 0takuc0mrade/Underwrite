mod livenet_common;

use livenet_common::{gas_limit, load_settlement, read_agent_report, submit_claim};
use odra::host::HostEnv;

fn main() {
    let env: HostEnv = odra_casper_livenet_env::env();
    env.set_gas(gas_limit());

    let mut settlement = load_settlement(&env);
    let claim = read_agent_report().claim_attestation;

    submit_claim(&mut settlement, claim.clone());

    println!("DuplicateClaimStatus: submitted");
    println!("ExpectedContractResult: ClaimAlreadyProcessed rejection if valid claim was submitted first");
    println!("ClaimId: {}", claim.claim_id);
}
