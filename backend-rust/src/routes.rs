use axum::routing::{get, post};
use axum::Router;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;

use crate::handlers;

pub fn build_router(pool: PgPool) -> Router {
    // CORS permisivo: solo para desarrollo. En producción restringir orígenes.
    let cors = CorsLayer::permissive();

    Router::new()
        .route("/health", get(handlers::health))
        .route(
            "/api/companies",
            get(handlers::companies::list).post(handlers::companies::create),
        )
        .route(
            "/api/companies/:id",
            get(handlers::companies::get)
                .put(handlers::companies::update)
                .delete(handlers::companies::delete),
        )
        .route(
            "/api/loans",
            get(handlers::loans::list).post(handlers::loans::create),
        )
        .route("/api/loans/:id", get(handlers::loans::get))
        .route(
            "/api/loans/:id/payments",
            post(handlers::payments::register),
        )
        .route("/api/dashboard", get(handlers::dashboard::get))
        .layer(cors)
        .with_state(pool)
}
