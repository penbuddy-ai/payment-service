# 🔍 HTTP Logging System

Ce système de logging capture automatiquement toutes les requêtes HTTP entrantes et sortantes en mode développement.

## 📋 Fonctionnalités

### ✅ Requêtes Entrantes (LoggingInterceptor)
- Capture automatique de toutes les requêtes HTTP vers l'API
- Logs détaillés : méthode, URL, headers, body, query params
- Mesure du temps de réponse
- Logs des erreurs avec stack trace
- Génération d'ID unique pour tracking

### ✅ Requêtes Sortantes (HttpClientLogger)
- Logging des appels vers les services externes (Stripe, Auth Service)
- Support pour `fetch()` avec wrapper `loggedFetch()`
- Mesure de performance des appels externes
- Logs d'erreurs de connectivité

## 🔒 Sécurité

### Headers Sensibles Masqués
- `authorization`
- `cookie`
- `x-api-key`
- `x-service-key`
- `stripe-signature`

### Champs de Body Sensibles Masqués
- `password`
- `token`
- `secret`
- `paymentMethodId`
- `cardNumber`
- `cvv`
- `client_secret`

## 🚀 Configuration

### Activation Automatique
Le logging s'active automatiquement en mode développement :
```typescript
// Dans main.ts
const isDevelopment = configService.get('NODE_ENV', 'development') === 'development';
if (isDevelopment) {
  app.useGlobalInterceptors(new LoggingInterceptor());
}
```

### Variables d'Environnement
```bash
NODE_ENV=development  # Active le logging
NODE_ENV=production   # Désactive le logging
```

## 📖 Exemples d'Usage

### Requête Entrante
```
🔵 INCOMING REQUEST [abc123def]
┌─ Method: POST
├─ URL: /api/v1/subscriptions
├─ IP: 127.0.0.1
├─ User-Agent: Mozilla/5.0...
├─ Query: {}
├─ Params: {}
├─ Headers: {"content-type":"application/json","authorization":"[REDACTED]"}
└─ Body: {
  "userId": "user_123",
  "plan": "monthly",
  "paymentMethodId": "[REDACTED]"
}

🟢 OUTGOING RESPONSE [abc123def]
┌─ Status: 201
├─ Duration: 245ms
├─ Response Size: 156 bytes
├─ Headers: {"content-type":"application/json"}
└─ Data: {
  "id": "sub_123",
  "status": "active",
  "plan": "monthly"
}
```

### Requête Sortante
```typescript
// Utilisation du HttpClientLogger
import { HttpClientLogger } from '../interceptors/http-client.interceptor';

@Injectable()
export class MyService {
  private readonly httpLogger = new HttpClientLogger();
  
  async callExternalAPI() {
    // En mode développement, utilise loggedFetch
    const response = await this.httpLogger.loggedFetch(url, options);
    return response.json();
  }
}
```

```
🔵 OUTBOUND REQUEST [xyz789abc]
┌─ Method: POST
├─ URL: https://api.stripe.com/v1/customers
├─ Headers: {"authorization":"[REDACTED]","content-type":"application/json"}
└─ Body: {
  "email": "user@example.com",
  "name": "John Doe"
}

🟢 OUTBOUND RESPONSE [xyz789abc]
┌─ Status: 200
├─ Duration: 156ms
└─ Data: {
  "id": "cus_123456789",
  "email": "user@example.com"
}
```

## 🧪 Test du Logging

### Endpoint de Test
```bash
# Test d'une requête avec logging
curl -X POST http://localhost:3003/api/v1/test-logging \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "sensitive": "secret"}'
```

### Résultat Attendu
- Log de la requête entrante avec body sanitisé
- Log de la réponse sortante
- ID de tracking pour lier requête/réponse

## ⚡ Performance

### Impact Minimal
- Logging uniquement en développement
- Sanitisation efficace des données sensibles
- Pas d'impact sur les performances en production

### Optimisations
- Troncature des réponses longues (>1000 chars)
- Clonage des réponses pour éviter la consommation
- Génération d'ID légers pour tracking

## 🎯 Utilisation Recommandée

1. **Développement Local** : Activation automatique
2. **Debug** : Utiliser les ID de tracking pour lier requêtes/réponses
3. **Audit** : Vérifier les appels vers services externes
4. **Performance** : Analyser les temps de réponse

## 🔧 Personnalisation

### Ajouter des Champs Sensibles
```typescript
// Dans LoggingInterceptor ou HttpClientLogger
const sensitiveFields = [
  'password',
  'newSensitiveField',  // Ajouter ici
  // ...
];
```

### Modifier les Seuils de Troncature
```typescript
// Modifier les limites dans sanitizeResponseData()
return jsonString.length > 2000  // Nouvelle limite
  ? `${jsonString.substring(0, 2000)}...`
  : jsonString;
``` 