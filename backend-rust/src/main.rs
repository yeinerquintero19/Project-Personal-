mod config;
mod db;
mod error;
mod handlers;
mod interest;
mod models;
mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let config = config::Config::from_env();
    let pool = db::connect(&config.database_url).await?;
    println!("[prestapro-rust] Conectado a PostgreSQL");

    let app = routes::build_router(pool);
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("[prestapro-rust] API escuchando en http://{addr}");

    axum::serve(listener, app).await?;
    Ok(())
}
