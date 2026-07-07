use odra::casper_types::U256;
use odra::host::{Deployer, HostEnv};
use odra::prelude::*;
use underwrite_contracts::{
    settlement::{UnderwriteSettlement, UnderwriteSettlementInitArgs},
    token::{SettlementToken, SettlementTokenInitArgs},
};

fn main() {
    let env: HostEnv = odra_casper_livenet_env::env();
    let agent = env.caller();

    const MIN_DEPLOY_GAS: u64 = 400_000_000_000;
    let deploy_gas = std::env::var("CASPER_DEPLOY_GAS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(MIN_DEPLOY_GAS);
    env.set_gas(deploy_gas);
    let mut token = SettlementToken::try_deploy(
        &env,
        SettlementTokenInitArgs {
            initial_supply: U256::from(100_000_000u64),
        },
    )
    .unwrap_or_else(|error| panic!("SettlementToken deployment failed: {error:?}"));
    let settlement = UnderwriteSettlement::try_deploy(
        &env,
        UnderwriteSettlementInitArgs {
            agent,
            token_address: token.address(),
        },
    )
    .unwrap_or_else(|error| panic!("UnderwriteSettlement deployment failed: {error:?}"));
    token.transfer(&settlement.address(), &U256::from(50_000_000u64));

    println!("SettlementToken: {}", token.address().to_string());
    println!("UnderwriteSettlement: {}", settlement.address().to_string());
    println!("Vault: {}", settlement.address().to_string());
    println!("Agent: {}", agent.to_string());
    println!("VaultFundingMinor: 50000000");
}
