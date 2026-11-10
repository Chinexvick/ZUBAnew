# ZUBA staking worker (test deployment)

Runs the staking back office: handles requests from the website, watches deposits, pays rewards and withdrawals.
The only entry point is `/api/tick`, which needs the tick token. All settings come from environment variables.
