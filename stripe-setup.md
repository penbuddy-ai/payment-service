# 🔐 Configuration Stripe - Guide Penpal AI

## Étape 1: Compte et Clés API

### 1.1 Dashboard Stripe

1. Connectez-vous à [dashboard.stripe.com](https://dashboard.stripe.com)
2. Assurez-vous d'être en **mode TEST** (toggle en haut à droite)
3. Allez dans **Developers > API keys**

### 1.2 Récupérer les clés

```bash
# Clés à récupérer :
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxx    # Clé publique (commence par pk_test_)
STRIPE_SECRET_KEY=sk_test_xxxxxx         # Clé secrète (commence par sk_test_)
```

## Étape 2: Créer les Produits et Prix

### 2.1 Via Dashboard Stripe

1. Allez dans **Products > Add product**
2. Créez deux produits :

**Produit 1: Abonnement Mensuel**

- Name: `Penpal AI - Abonnement Mensuel`
- Description: `Accès complet à Penpal AI - Facturation mensuelle`
- Price: `20.00 EUR`
- Billing: `Recurring` - `Monthly`
- Copier le **Price ID** (commence par `price_`)

**Produit 2: Abonnement Annuel**

- Name: `Penpal AI - Abonnement Annuel`
- Description: `Accès complet à Penpal AI - Facturation annuelle (10 mois)`
- Price: `200.00 EUR`
- Billing: `Recurring` - `Yearly`
- Copier le **Price ID** (commence par `price_`)

### 2.2 Via API (Automatique)

Vous pouvez utiliser ce script pour créer automatiquement :

```bash
curl https://api.stripe.com/v1/products \
  -u sk_test_VOTRE_CLE_SECRETE: \
  -d name="Penpal AI - Abonnement Mensuel" \
  -d description="Accès complet à Penpal AI - Facturation mensuelle"

curl https://api.stripe.com/v1/prices \
  -u sk_test_VOTRE_CLE_SECRETE: \
  -d currency=eur \
  -d unit_amount=2000 \
  -d recurring[interval]=month \
  -d product=prod_XXXX

curl https://api.stripe.com/v1/prices \
  -u sk_test_VOTRE_CLE_SECRETE: \
  -d currency=eur \
  -d unit_amount=20000 \
  -d recurring[interval]=year \
  -d product=prod_XXXX
```

## Étape 3: Configurer les Webhooks

### 3.1 Créer l'endpoint webhook

1. Dans le Dashboard: **Developers > Webhooks**
2. Cliquez **Add endpoint**
3. URL endpoint: `https://votre-domaine.com/webhooks/stripe`
   - Pour le dev local: `http://localhost:3003/webhooks/stripe`
   - Utilisez ngrok pour exposer le localhost

### 3.2 Événements à sélectionner

```
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
payment_intent.succeeded
payment_intent.payment_failed
```

### 3.3 Récupérer le secret

- Copier le **Webhook signing secret** (commence par `whsec_`)

## Étape 4: Configuration du Service

### 4.1 Fichier d'environnement

Créer `/penpal-db-service/compose/payment-service/.env` :

```env
# Server Configuration
PORT=3003
NODE_ENV=development
CORS_ORIGIN=*

# Database
MONGODB_URI=mongodb://penpal_user:penpal_password@mongodb:27017/penpal-payment?authSource=admin

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_VOTRE_CLE_PUBLIQUE
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_SECRET

# Stripe Price IDs
STRIPE_PRICE_MONTHLY=price_VOTRE_ID_MENSUEL
STRIPE_PRICE_YEARLY=price_VOTRE_ID_ANNUEL

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# External Services URLs
AUTH_SERVICE_URL=http://auth-service:3002
DB_SERVICE_URL=http://db-service:3001
MAIL_SERVICE_URL=http://mail-service:3004

# Cache (Redis)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis123
```

### 4.2 Mettre à jour le service

Modifier `src/common/services/stripe.service.ts` pour utiliser les vrais IDs :

```typescript
private getPriceId(plan: SubscriptionPlan): string {
  const priceIds = {
    [SubscriptionPlan.MONTHLY]: process.env.STRIPE_PRICE_MONTHLY,
    [SubscriptionPlan.YEARLY]: process.env.STRIPE_PRICE_YEARLY,
  };
  return priceIds[plan];
}
```

## Étape 5: Tests de Développement

### 5.1 Ngrok pour les webhooks locaux

```bash
# Installer ngrok
npm install -g ngrok

# Exposer le service local
ngrok http 3003

# Utiliser l'URL HTTPS générée pour le webhook
```

### 5.2 Cartes de test Stripe

```
# Carte réussie
4242 4242 4242 4242

# Carte échec
4000 0000 0000 0002

# Carte nécessitant 3D Secure
4000 0025 0000 3155
```

## Étape 6: Vérification

### 6.1 Test de l'API

```bash
# Créer un abonnement
curl -X POST http://localhost:3003/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "email": "test@example.com",
    "name": "Test User",
    "plan": "monthly"
  }'

# Vérifier le statut
curl http://localhost:3003/subscriptions/user/test_user_123/status
```

### 6.2 Vérifier dans Stripe Dashboard

- **Customers**: Nouveau client créé
- **Subscriptions**: Abonnement en mode trial
- **Events**: Événements webhook reçus

## 🚨 Important - Sécurité

1. **Jamais** de clés de production en développement
2. Garder les clés secrètes dans `.env` (exclu de Git)
3. Utiliser HTTPS en production
4. Valider tous les webhooks avec signature
5. Logger toutes les transactions

## 📋 Checklist de Configuration

- [ ] Compte Stripe créé/configuré
- [ ] Mode TEST activé
- [ ] Clés API récupérées
- [ ] Produits mensuel/annuel créés
- [ ] Prix configurés (20€/200€)
- [ ] Webhook endpoint créé
- [ ] Événements webhook sélectionnés
- [ ] Secret webhook récupéré
- [ ] Fichier .env configuré
- [ ] Service testé localement
- [ ] Webhooks testés avec ngrok

## 🔗 Liens Utiles

- [Dashboard Stripe](https://dashboard.stripe.com)
- [Documentation API](https://stripe.com/docs/api)
- [Guide Webhooks](https://stripe.com/docs/webhooks)
- [Cartes de test](https://stripe.com/docs/testing)
