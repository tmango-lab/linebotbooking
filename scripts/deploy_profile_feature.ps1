# Deploy functions
npx supabase functions deploy webhook --no-verify-jwt
npx supabase functions deploy validate-promo-code --no-verify-jwt

# Confirmation
Write-Host "Deployment Complete. Please also ensure you have run the SQL migration."
