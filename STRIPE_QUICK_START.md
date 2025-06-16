# 🚀 Démarrage Rapide - Configuration Stripe

## Option 1: Configuration Automatique (Recommandée)

```bash
# 1. Installer les dépendances si pas déjà fait
npm install

# 2. Lancer le script de configuration automatique
npm run stripe:setup
```

Le script vous guidera pour :

- ✅ Saisir vos clés API Stripe
- ✅ Créer automatiquement les produits (20€/mois, 200€/an)
- ✅ Configurer les webhooks
- ✅ Générer le fichier .env

## Option 2: Configuration Manuelle

### 1. Récupérer les clés Stripe

- Allez sur [dashboard.stripe.com](https://dashboard.stripe.com)
- Mode **TEST** activé
- **Developers > API keys**

### 2. Créer les produits

- **Products > Add product**
- Mensuel: 20€/mois
- Annuel: 200€/an
- Copier les Price IDs

### 3. Configurer les webhooks

- **Developers > Webhooks > Add endpoint**
- URL: `http://localhost:3003/webhooks/stripe`
- Événements: subscription._, invoice._, payment_intent.\*

### 4. Créer le fichier .env

```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
```

## Validation

```bash
# Tester la configuration
npm run stripe:test

# Démarrer le service
npm run start:dev

# Vérifier l'API
curl http://localhost:3003/
curl http://localhost:3003/api/docs
```

## 💳 Tests avec cartes simulées

```
Succès:      4242 4242 4242 4242
Échec:       4000 0000 0000 0002
3D Secure:   4000 0025 0000 3155
```

## 🔗 Webhooks en développement

```bash
# Installer ngrok pour exposer localhost
npm install -g ngrok

# Exposer le service
ngrok http 3003

# Utiliser l'URL HTTPS pour le webhook Stripe
```

## 📋 API Endpoints Disponibles

- `POST /subscriptions` - Créer un abonnement
- `GET /subscriptions/user/:userId/status` - Statut utilisateur
- `POST /subscriptions/user/:userId/activate` - Activer l'abonnement
- `DELETE /subscriptions/user/:userId/cancel` - Annuler
- `POST /webhooks/stripe` - Webhook Stripe

## ⚠️ Important

- **Toujours** utiliser les clés **TEST** en développement
- Garder les clés secrètes dans `.env` (exclu de Git)
- Valider les webhooks avec la signature Stripe
- Logger toutes les transactions

## 🆘 Problèmes Courants

**Erreur "Invalid API key"**

- Vérifiez que vous utilisez les bonnes clés
- Mode TEST/LIVE correspond à vos clés

**Webhook non reçu**

- Utilisez ngrok pour exposer localhost
- Vérifiez les événements sélectionnés
- Consultez les logs Stripe Dashboard

**Prix non trouvé**

- Vérifiez les Price IDs dans .env
- Créez les produits dans Stripe Dashboard

## 📞 Support

- Documentation Stripe: [stripe.com/docs](https://stripe.com/docs)
- Guide complet: `stripe-setup.md`
- Tests: `npm run stripe:test`
