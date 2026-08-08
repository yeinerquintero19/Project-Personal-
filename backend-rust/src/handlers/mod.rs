pub mod companies;
pub mod dashboard;
pub mod loans;
pub mod payments;

use axum::Json;
use serde_json::{json, Value};

pub async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "merprest-rust",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
