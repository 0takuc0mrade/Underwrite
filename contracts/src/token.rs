use odra::{casper_types::U256, prelude::*};
use odra_modules::cep18_token::Cep18;

#[odra::module]
pub struct SettlementToken {
    token: SubModule<Cep18>,
}

#[odra::module]
impl SettlementToken {
    pub fn init(&mut self, initial_supply: U256) {
        self.token.init(
            "UWT".to_string(),
            "Underwrite Settlement Token".to_string(),
            2,
            initial_supply,
        );
    }

    delegate! {
        to self.token {
            fn name(&self) -> String;
            fn symbol(&self) -> String;
            fn decimals(&self) -> u8;
            fn total_supply(&self) -> U256;
            fn balance_of(&self, address: &Address) -> U256;
            fn allowance(&self, owner: &Address, spender: &Address) -> U256;
            fn approve(&mut self, spender: &Address, amount: &U256);
            fn transfer(&mut self, recipient: &Address, amount: &U256);
            fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
        }
    }
}
