use odra::{
    casper_types::{bytesrepr::Bytes, PublicKey, U256},
    prelude::*,
};
use odra_modules::cep18_token::Cep18ContractRef;

const MAX_CLAIM_AGE_SECONDS: u64 = 24 * 60 * 60;

#[odra::odra_type]
pub struct Policy {
    pub claimant: Address,
    pub insured_value_minor: u64,
    pub currency: String,
    pub oracle_public_key: String,
    pub active: bool,
}

#[odra::odra_type]
pub struct ClaimRecord {
    pub policy_number: String,
    pub claimant: Address,
    pub evidence_hash: String,
    pub payout_percentage: u8,
    pub payout_amount_minor: u64,
    pub observed_at: u64,
}

#[odra::odra_error]
pub enum Error {
    NotOwner = 1,
    NotAgent = 2,
    PolicyMissing = 3,
    PolicyInactive = 4,
    InvalidClaimant = 5,
    InvalidOracle = 6,
    InvalidSignature = 7,
    ClaimAlreadyProcessed = 8,
    NonQualifyingClaim = 9,
    InvalidPayout = 10,
    StaleClaim = 11,
    FutureClaim = 12,
    ExpiredClaim = 13,
}

#[odra::event]
pub struct PolicyRegistered {
    pub policy_number: String,
    pub claimant: Address,
    pub insured_value_minor: u64,
}

#[odra::event]
pub struct ClaimSettled {
    pub claim_id: String,
    pub policy_number: String,
    pub claimant: Address,
    pub evidence_hash: String,
    pub payout_percentage: u8,
    pub payout_amount_minor: u64,
    pub observed_at: u64,
}

#[odra::module(
    errors = Error,
    events = [PolicyRegistered, ClaimSettled]
)]
pub struct UnderwriteSettlement {
    owner: Var<Address>,
    agent: Var<Address>,
    token: External<Cep18ContractRef>,
    policies: Mapping<String, Policy>,
    processed_claims: Mapping<String, bool>,
    claims: Mapping<String, ClaimRecord>,
}

#[odra::module]
impl UnderwriteSettlement {
    pub fn init(&mut self, agent: Address, token_address: Address) {
        self.owner.set(self.env().caller());
        self.agent.set(agent);
        self.token.set(token_address);
    }

    pub fn register_policy(
        &mut self,
        policy_number: String,
        claimant: Address,
        insured_value_minor: u64,
        currency: String,
        oracle_public_key: String,
    ) {
        self.assert_owner();
        self.store_policy(
            policy_number,
            claimant,
            insured_value_minor,
            currency,
            oracle_public_key,
        );
    }

    pub fn register_policy_self(
        &mut self,
        policy_number: String,
        claimant: Address,
        insured_value_minor: u64,
        currency: String,
        oracle_public_key: String,
    ) {
        if self.env().caller() != claimant {
            self.env().revert(Error::InvalidClaimant);
        }
        self.store_policy(
            policy_number,
            claimant,
            insured_value_minor,
            currency,
            oracle_public_key,
        );
    }

    #[allow(clippy::too_many_arguments)]
    pub fn settle_claim(
        &mut self,
        claim_id: String,
        policy_number: String,
        claimant: Address,
        evidence_hash: String,
        status: u8,
        delay_hours: u64,
        payout_amount_minor: u64,
        observed_at: u64,
        expires_at: u64,
        signature: Bytes,
        public_key: PublicKey,
    ) {
        self.assert_agent();
        if self.processed_claims.get_or_default(&claim_id) {
            self.env().revert(Error::ClaimAlreadyProcessed);
        }

        let policy = self
            .policies
            .get(&policy_number)
            .unwrap_or_revert_with(self, Error::PolicyMissing);
        if !policy.active {
            self.env().revert(Error::PolicyInactive);
        }
        if policy.claimant != claimant {
            self.env().revert(Error::InvalidClaimant);
        }
        if policy.oracle_public_key != public_key.to_hex_string() {
            self.env().revert(Error::InvalidOracle);
        }
        if !self
            .env()
            .verify_signature(&Bytes::from(claim_id.as_bytes()), &signature, &public_key)
        {
            self.env().revert(Error::InvalidSignature);
        }

        let now = block_time_seconds(self.env().get_block_time());
        if observed_at > now {
            self.env().revert(Error::FutureClaim);
        }
        if now - observed_at > MAX_CLAIM_AGE_SECONDS {
            self.env().revert(Error::StaleClaim);
        }
        if expires_at < now {
            self.env().revert(Error::ExpiredClaim);
        }

        let payout_percentage = payout_percentage(status, delay_hours);
        if payout_percentage == 0 {
            self.env().revert(Error::NonQualifyingClaim);
        }
        let expected_amount = policy.insured_value_minor * u64::from(payout_percentage) / 100;
        if payout_amount_minor == 0 || payout_amount_minor != expected_amount {
            self.env().revert(Error::InvalidPayout);
        }

        self.processed_claims.set(&claim_id, true);
        self.claims.set(
            &claim_id,
            ClaimRecord {
                policy_number: policy_number.clone(),
                claimant,
                evidence_hash: evidence_hash.clone(),
                payout_percentage,
                payout_amount_minor,
                observed_at,
            },
        );
        self.token
            .transfer(&claimant, &U256::from(payout_amount_minor));
        self.env().emit_event(ClaimSettled {
            claim_id,
            policy_number,
            claimant,
            evidence_hash,
            payout_percentage,
            payout_amount_minor,
            observed_at,
        });
    }

    pub fn policy(&self, policy_number: String) -> Option<Policy> {
        self.policies.get(&policy_number)
    }

    pub fn claim(&self, claim_id: String) -> Option<ClaimRecord> {
        self.claims.get(&claim_id)
    }

    pub fn is_processed(&self, claim_id: String) -> bool {
        self.processed_claims.get_or_default(&claim_id)
    }

    pub fn agent(&self) -> Address {
        self.agent.get().unwrap_or_revert(self)
    }

    fn assert_owner(&self) {
        if self.env().caller() != self.owner.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotOwner);
        }
    }

    fn assert_agent(&self) {
        if self.env().caller() != self.agent.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAgent);
        }
    }

    fn store_policy(
        &mut self,
        policy_number: String,
        claimant: Address,
        insured_value_minor: u64,
        currency: String,
        oracle_public_key: String,
    ) {
        self.policies.set(
            &policy_number,
            Policy {
                claimant,
                insured_value_minor,
                currency,
                oracle_public_key,
                active: true,
            },
        );
        self.env().emit_event(PolicyRegistered {
            policy_number,
            claimant,
            insured_value_minor,
        });
    }
}

pub fn payout_percentage(status: u8, delay_hours: u64) -> u8 {
    if status != 2 && status != 3 {
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

fn block_time_seconds(block_time: u64) -> u64 {
    if block_time > 10_000_000_000 {
        block_time / 1_000
    } else {
        block_time
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::token::{SettlementToken, SettlementTokenInitArgs};
    use odra::host::{Deployer, HostRef};

    const POLICY: &str = "MRC-CRG-2026-00481";
    const EVIDENCE_HASH: &str = "evidence-67d123";
    const INSURED_VALUE: u64 = 12_500_000;
    const VAULT_FUNDING: u64 = 50_000_000;

    struct TestSetup {
        settlement: UnderwriteSettlementHostRef,
        token: crate::token::SettlementTokenHostRef,
        oracle_account: Address,
        public_key: PublicKey,
    }

    fn setup_with_policy(insured_value_minor: u64, vault_funding: u64) -> TestSetup {
        let env = odra_test::env();
        let owner = env.get_account(0);
        let agent = env.get_account(1);
        let claimant = env.get_account(2);
        let oracle_account = env.get_account(3);
        let public_key = env.public_key(&oracle_account);

        env.set_caller(owner);
        let mut token = SettlementToken::deploy(
            &env,
            SettlementTokenInitArgs {
                initial_supply: U256::from(100_000_000u64),
            },
        );
        let mut settlement = UnderwriteSettlement::deploy(
            &env,
            UnderwriteSettlementInitArgs {
                agent,
                token_address: token.address(),
            },
        );
        token.transfer(&settlement.address(), &U256::from(vault_funding));
        settlement.register_policy(
            POLICY.to_string(),
            claimant,
            insured_value_minor,
            "USD".to_string(),
            public_key.to_hex_string(),
        );
        TestSetup {
            settlement,
            token,
            oracle_account,
            public_key,
        }
    }

    fn setup() -> TestSetup {
        setup_with_policy(INSURED_VALUE, VAULT_FUNDING)
    }

    #[allow(clippy::too_many_arguments)]
    fn settle(
        settlement: &mut UnderwriteSettlementHostRef,
        oracle_account: Address,
        public_key: PublicKey,
        claim_id: &str,
        caller: Address,
        claimant: Address,
        status: u8,
        delay_hours: u64,
        payout: u64,
        observed_at: u64,
        expires_at: u64,
    ) -> Result<(), OdraError> {
        let env = settlement.env().clone();
        let signature = env.sign_message(&Bytes::from(claim_id.as_bytes()), &oracle_account);
        env.set_caller(caller);
        settlement.try_settle_claim(
            claim_id.to_string(),
            POLICY.to_string(),
            claimant,
            EVIDENCE_HASH.to_string(),
            status,
            delay_hours,
            payout,
            observed_at,
            expires_at,
            signature,
            public_key,
        )
    }

    fn settle_valid(
        settlement: &mut UnderwriteSettlementHostRef,
        oracle_account: Address,
        public_key: PublicKey,
        delay_hours: u64,
        payout: u64,
    ) -> Result<(), OdraError> {
        let env = settlement.env().clone();
        settle(
            settlement,
            oracle_account,
            public_key,
            &format!("claim-{delay_hours}"),
            env.get_account(1),
            env.get_account(2),
            2,
            delay_hours,
            payout,
            0,
            3_600,
        )
    }

    #[test]
    fn payout_boundaries_are_exact() {
        assert_eq!(payout_percentage(2, 47), 0);
        assert_eq!(payout_percentage(2, 48), 25);
        assert_eq!(payout_percentage(2, 71), 25);
        assert_eq!(payout_percentage(2, 72), 50);
        assert_eq!(payout_percentage(2, 119), 50);
        assert_eq!(payout_percentage(2, 120), 75);
        assert_eq!(payout_percentage(2, 239), 75);
        assert_eq!(payout_percentage(2, 240), 100);
    }

    #[test]
    fn policy_registration_succeeds() {
        let setup = setup();
        let claimant = setup.settlement.env().get_account(2);
        let policy = setup.settlement.policy(POLICY.to_string()).unwrap();

        assert_eq!(policy.claimant, claimant);
        assert_eq!(policy.insured_value_minor, INSURED_VALUE);
        assert_eq!(policy.currency, "USD");
        assert_eq!(policy.oracle_public_key, setup.public_key.to_hex_string());
        assert!(policy.active);
    }

    #[test]
    fn non_owner_cannot_use_operator_policy_registration() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        let non_owner = env.get_account(4);
        let claimant = env.get_account(5);

        env.set_caller(non_owner);
        assert_eq!(
            setup
                .settlement
                .try_register_policy(
                    "MRC-CRG-2026-NONOWNER".to_string(),
                    claimant,
                    INSURED_VALUE,
                    "USD".to_string(),
                    setup.public_key.to_hex_string(),
                )
                .unwrap_err(),
            Error::NotOwner.into()
        );
    }

    #[test]
    fn self_policy_registration_uses_the_wallet_caller_as_claimant() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        let wallet_claimant = env.get_account(4);
        let policy_number = "MRC-CRG-2026-SELF";

        env.set_caller(wallet_claimant);
        setup.settlement.register_policy_self(
            policy_number.to_string(),
            wallet_claimant,
            9_000_000,
            "USD".to_string(),
            setup.public_key.to_hex_string(),
        );

        let policy = setup.settlement.policy(policy_number.to_string()).unwrap();
        assert_eq!(policy.claimant, wallet_claimant);
        assert_eq!(policy.insured_value_minor, 9_000_000);
        assert_eq!(policy.currency, "USD");
        assert_eq!(policy.oracle_public_key, setup.public_key.to_hex_string());
        assert!(policy.active);
    }

    #[test]
    fn self_policy_registration_cannot_register_for_another_claimant() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        let wallet_caller = env.get_account(4);
        let different_claimant = env.get_account(5);

        env.set_caller(wallet_caller);
        assert_eq!(
            setup
                .settlement
                .try_register_policy_self(
                    "MRC-CRG-2026-BADSELF".to_string(),
                    different_claimant,
                    INSURED_VALUE,
                    "USD".to_string(),
                    setup.public_key.to_hex_string(),
                )
                .unwrap_err(),
            Error::InvalidClaimant.into()
        );
    }

    #[test]
    fn qualifying_claim_transfers_cep18_tokens() {
        let mut setup = setup();
        let claimant = setup.settlement.env().get_account(2);
        settle_valid(
            &mut setup.settlement,
            setup.oracle_account,
            setup.public_key,
            75,
            6_250_000,
        )
        .unwrap();
        assert_eq!(setup.token.balance_of(&claimant), U256::from(6_250_000u64));
        assert!(setup.settlement.is_processed("claim-75".to_string()));
    }

    #[test]
    fn valid_claim_stores_settlement_record() {
        let mut setup = setup();
        let claimant = setup.settlement.env().get_account(2);
        settle_valid(
            &mut setup.settlement,
            setup.oracle_account,
            setup.public_key,
            75,
            6_250_000,
        )
        .unwrap();

        let record = setup.settlement.claim("claim-75".to_string()).unwrap();
        assert_eq!(record.policy_number, POLICY);
        assert_eq!(record.claimant, claimant);
        assert_eq!(record.evidence_hash, EVIDENCE_HASH);
        assert_eq!(record.payout_percentage, 50);
        assert_eq!(record.payout_amount_minor, 6_250_000);
    }

    #[test]
    fn unauthorized_agent_is_rejected() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        assert_eq!(
            settle(
                &mut setup.settlement,
                setup.oracle_account,
                setup.public_key,
                "claim-unauthorized",
                env.get_account(4),
                env.get_account(2),
                2,
                75,
                6_250_000,
                0,
                3_600,
            )
            .unwrap_err(),
            Error::NotAgent.into()
        );
    }

    #[test]
    fn wrong_oracle_public_key_is_rejected() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        let wrong_public_key = env.public_key(&env.get_account(4));
        assert_eq!(
            settle(
                &mut setup.settlement,
                setup.oracle_account,
                wrong_public_key,
                "claim-wrong-oracle",
                env.get_account(1),
                env.get_account(2),
                2,
                75,
                6_250_000,
                0,
                3_600,
            )
            .unwrap_err(),
            Error::InvalidOracle.into()
        );
    }

    #[test]
    fn stale_claim_is_rejected() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        env.advance_block_time(MAX_CLAIM_AGE_SECONDS + 1);
        let now = env.block_time();
        assert_eq!(
            settle(
                &mut setup.settlement,
                setup.oracle_account,
                setup.public_key,
                "claim-stale",
                env.get_account(1),
                env.get_account(2),
                2,
                75,
                6_250_000,
                0,
                now + 3_600,
            )
            .unwrap_err(),
            Error::StaleClaim.into()
        );
    }

    #[test]
    fn expired_claim_is_rejected() {
        let mut setup = setup();
        let env = setup.settlement.env().clone();
        env.advance_block_time(100);
        assert_eq!(
            settle(
                &mut setup.settlement,
                setup.oracle_account,
                setup.public_key,
                "claim-expired",
                env.get_account(1),
                env.get_account(2),
                2,
                75,
                6_250_000,
                0,
                99,
            )
            .unwrap_err(),
            Error::ExpiredClaim.into()
        );
    }

    #[test]
    fn duplicate_claim_is_rejected() {
        let mut setup = setup();
        settle_valid(
            &mut setup.settlement,
            setup.oracle_account,
            setup.public_key.clone(),
            75,
            6_250_000,
        )
        .unwrap();
        assert_eq!(
            settle_valid(
                &mut setup.settlement,
                setup.oracle_account,
                setup.public_key,
                75,
                6_250_000,
            )
            .unwrap_err(),
            Error::ClaimAlreadyProcessed.into()
        );
    }

    #[test]
    fn incorrect_payout_is_rejected() {
        let mut setup = setup();
        assert_eq!(
            settle_valid(
                &mut setup.settlement,
                setup.oracle_account,
                setup.public_key,
                75,
                1,
            )
            .unwrap_err(),
            Error::InvalidPayout.into()
        );
    }

    #[test]
    fn insufficient_vault_funds_are_rejected() {
        let mut setup = setup_with_policy(100_000_000, 1_000);
        assert!(settle_valid(
            &mut setup.settlement,
            setup.oracle_account,
            setup.public_key,
            75,
            50_000_000,
        )
        .is_err());
    }

    #[test]
    fn block_time_seconds_accepts_seconds_or_millis() {
        assert_eq!(block_time_seconds(1_782_661_353), 1_782_661_353);
        assert_eq!(block_time_seconds(1_782_661_353_000), 1_782_661_353);
    }
}
