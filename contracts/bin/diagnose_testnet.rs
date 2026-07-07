use odra::casper_types::{AsymmetricType, PublicKey, SecretKey};
use std::env;

fn main() {
    let key_path = env::var("ODRA_CASPER_LIVENET_SECRET_KEY_PATH")
        .or_else(|_| env::var("CASPER_ACCOUNT_SECRET_KEY_PATH"))
        .expect("missing ODRA_CASPER_LIVENET_SECRET_KEY_PATH or CASPER_ACCOUNT_SECRET_KEY_PATH");
    let secret_key = SecretKey::from_file(&key_path).expect("failed to load Casper secret key");
    let public_key = PublicKey::from(&secret_key);

    println!("publicKey={}", public_key.to_hex());
    println!(
        "accountHash={}",
        public_key.to_account_hash().to_formatted_string()
    );
}
