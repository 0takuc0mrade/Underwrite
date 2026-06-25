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

    env.set_gas(300_000_000_000u64);
    let mut token = SettlementToken::deploy(
        &env,
        SettlementTokenInitArgs {
            initial_supply: U256::from(100_000_000u64),
        },
    );
    let settlement = UnderwriteSettlement::deploy(
        &env,
        UnderwriteSettlementInitArgs {
            agent,
            token_address: token.address(),
        },
    );
    token.transfer(&settlement.address(), &U256::from(50_000_000u64));

    println!("SettlementToken: {:?}", token.address());
    println!("UnderwriteSettlement: {:?}", settlement.address());
    println!("Vault: {:?}", settlement.address());
    println!("Agent: {:?}", agent);
    println!("VaultFundingMinor: 50000000");
}
