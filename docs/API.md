# API
Swagger: `http://localhost:3001/docs`

## Curl quick checks
- Register owner
`curl -X POST http://localhost:3001/auth/register-owner -H 'content-type: application/json' -d '{"businessName":"Flow","name":"Owner","email":"owner@flow.com","password":"Password123!"}'`
- Login
`curl -X POST http://localhost:3001/auth/login -H 'content-type: application/json' -d '{"email":"owner@flow.com","password":"Password123!"}'`
