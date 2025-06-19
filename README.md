# Penpal AI Payment Service

Service de gestion des paiements pour Penpal AI, gérant les abonnements, les transactions et l'intégration avec Stripe.

## 🚀 Fonctionnalités

- ✅ Gestion des abonnements avec période d'essai gratuite (30 jours)
- ✅ Intégration complète avec Stripe
- ✅ Paiements récurrents (mensuel/annuel)
- ✅ Webhooks Stripe pour synchronisation automatique
- ✅ Gestion des remboursements
- ✅ Logging et monitoring des transactions
- ✅ API REST documentée avec Swagger
- ✅ Validation des données avec class-validator
- ✅ Rate limiting pour la sécurité

## 🛠 Technologies

- **NestJS** - Framework Node.js
- **MongoDB** avec Mongoose - Base de données
- **Stripe** - Processeur de paiements
- **Swagger** - Documentation API
- **Class Validator** - Validation des données
- **TypeScript** - Typage statique

## 📋 Prérequis

- Node.js 16+
- MongoDB
- Compte Stripe (mode test pour développement)

## 🔧 Installation

1. **Cloner le repository** (si ce n'est pas déjà fait)

2. **Installer les dépendances**

   ```bash
   cd penpal-payment-service
   npm install
   ```

3. **Configuration de l'environnement**

   ```bash
   cp environment.template .env
   ```

   Modifier le fichier `.env` avec vos configurations :

   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/penpal-payment

   # Stripe (récupérer depuis le dashboard Stripe)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Démarrer MongoDB** (si local)

   ```bash
   # Avec Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest

   # Ou avec votre installation locale
   mongod
   ```

## 🚀 Démarrage

### Mode développement

```bash
npm run start:dev
```

### Mode production

```bash
npm run build
npm run start:prod
```

Le service sera disponible sur `http://localhost:3004`

## 📚 Documentation API

Une fois le service démarré, la documentation Swagger est disponible à :
`http://localhost:3004/api/docs`

## 🔐 Configuration Stripe

### 1. Créer un compte Stripe

- Aller sur [stripe.com](https://stripe.com)
- Créer un compte développeur
- Récupérer les clés API dans le dashboard

### 2. Configurer les produits et prix

```bash
# Créer les produits dans Stripe Dashboard ou via API
# Exemple pour un abonnement mensuel à 20€
curl https://api.stripe.com/v1/prices \
  -u sk_test_...: \
  -d currency=eur \
  -d unit_amount=2000 \
  -d recurring[interval]=month \
  -d product_data[name]="Penpal AI Monthly"
```

### 3. Configurer les webhooks

Dans le dashboard Stripe :

- Aller dans Developers > Webhooks
- Ajouter l'endpoint : `https://votre-domaine.com/api/v1/webhooks/stripe`
- Sélectionner les événements :
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

## 📊 Architecture

### Modules principaux

- **Subscription Module** - Gestion des abonnements
- **Payment Module** - Traitement des paiements
- **Webhook Module** - Événements Stripe
- **Billing Module** - Facturation

### Schemas MongoDB

- **Subscription** - Informations d'abonnement
- **Payment** - Transactions de paiement

### Services

- **StripeService** - Interface avec l'API Stripe
- **SubscriptionService** - Logique métier des abonnements
- **WebhookService** - Traitement des webhooks

## 🔄 Flow d'abonnement

1. **Inscription** - Création d'un abonnement avec 30 jours gratuits
2. **Période d'essai** - Utilisateur peut utiliser le service gratuitement
3. **Fin d'essai** - Notification pour ajouter un moyen de paiement
4. **Activation** - Conversion en abonnement payant
5. **Renouvellement** - Paiements automatiques via Stripe

## 🌐 Endpoints principaux

### Abonnements

- `POST /api/v1/subscriptions` - Créer un abonnement
- `GET /api/v1/subscriptions/user/:userId` - Récupérer un abonnement
- `GET /api/v1/subscriptions/user/:userId/status` - Statut d'abonnement
- `POST /api/v1/subscriptions/user/:userId/activate` - Activer l'abonnement payant
- `POST /api/v1/subscriptions/user/:userId/cancel` - Annuler l'abonnement

### Webhooks

- `POST /api/v1/webhooks/stripe` - Événements Stripe

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

## 📝 Logs

Les logs sont structurés et incluent :

- Création/modification d'abonnements
- Traitements de paiements
- Événements webhook
- Erreurs et exceptions

## 🔒 Sécurité

- Validation des webhooks Stripe
- Rate limiting sur les endpoints
- Validation des données d'entrée
- Logs d'audit pour toutes les transactions
- Aucune donnée de carte stockée (tokens Stripe uniquement)

## 🚨 Gestion d'erreurs

Le service gère automatiquement :

- Échecs de paiement
- Webhooks Stripe manqués
- Erreurs de réseau
- Timeouts

## 🔗 Intégration avec autres services

- **Auth Service** - Authentification utilisateur
- **DB Service** - Données utilisateur
- **Mail Service** - Notifications par email (à venir)

## 🎯 TODO

- [ ] Module de facturation complet
- [ ] Intégration avec le service mail
- [ ] Support PayPal
- [ ] Dashboard administrateur
- [ ] Métriques et analytics
- [ ] Tests d'intégration complets

## 📞 Support

Pour toute question ou problème :

1. Vérifier la documentation API
2. Consulter les logs du service
3. Vérifier la configuration Stripe

## 📄 Licence

Usage privé - Projet Penpal AI
