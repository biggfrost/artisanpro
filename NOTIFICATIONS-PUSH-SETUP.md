# 🔔 Configuration des notifications push — Guide pas à pas

Ce guide active les **vraies notifications sur téléphone** (même app fermée) pour
les managers et les ouvriers : nouveau message, devis signé, devis à valider,
devis validé/refusé, nouveau chantier assigné, pointage, chantier terminé.

Tout le code est déjà déployé. Il reste **4 étapes** à faire **une seule fois**
dans votre tableau de bord Supabase.

---

## Clés VAPID (déjà générées pour vous)

```
VAPID_PUBLIC_KEY  = BKqb8vYZ6OvM9SKQ8XyohFmiBouhiCjrBgv6-oroyNVCj2-6ABCn4MHcGy4XN5Mp-S342lzvmtRGtQ_KmPXKEjU
VAPID_PRIVATE_KEY = TIdpPTQ4U1xKAKtXR4cZeMfDW5YlDl9M8aQShEo0B1Q
```

La clé publique est déjà dans l'app. La clé privée servira à l'étape 3.

---

## Étape 1 — Créer la table des abonnements

1. Ouvrez l'[éditeur SQL Supabase](https://supabase.com/dashboard/project/zptxycatjuhjhjpsctot/sql/new)
2. Collez le contenu de **`supabase-push-notifications-migration.sql`**
3. Cliquez **Run**

---

## Étape 2 — Créer l'Edge Function « notify »

1. Dans Supabase, allez dans **Edge Functions** (menu de gauche) → **Create a new function**
2. Nommez-la exactement **`notify`**
3. Collez le contenu de **`supabase/functions/notify/index.ts`**
4. Cliquez **Deploy**

> Astuce : si l'éditeur dans le dashboard n'est pas disponible, installez le CLI :
> `npm i -g supabase` puis `supabase functions deploy notify --no-verify-jwt`

---

## Étape 3 — Ajouter les secrets (clés VAPID)

Dans **Edge Functions → notify → Secrets** (ou **Settings → Edge Functions → Secrets**), ajoutez :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY`  | `BKqb8vYZ6OvM9SKQ8XyohFmiBouhiCjrBgv6-oroyNVCj2-6ABCn4MHcGy4XN5Mp-S342lzvmtRGtQ_KmPXKEjU` |
| `VAPID_PRIVATE_KEY` | `TIdpPTQ4U1xKAKtXR4cZeMfDW5YlDl9M8aQShEo0B1Q` |
| `VAPID_SUBJECT`     | `mailto:votre-email@exemple.fr` |

---

## Étape 4 — Créer les déclencheurs (Database Webhooks)

Dans **Database → Webhooks** → **Create a new hook**, créez **un webhook par table**.
Pour chacun : Type = **HTTP Request**, méthode **POST**, URL =
`https://zptxycatjuhjhjpsctot.supabase.co/functions/v1/notify`,
en-tête `Authorization: Bearer <votre clé service_role>` (onglet Settings → API).

| Webhook | Table | Événements |
|---|---|---|
| notif messages   | `messages`     | Insert |
| notif devis       | `devis`        | Insert, Update |
| notif assignations | `assignations` | Insert |
| notif chantiers   | `chantiers`    | Update |
| notif pointages   | `pointages`    | Insert |

> Chaque webhook envoie la ligne modifiée à l'Edge Function, qui détermine
> automatiquement qui notifier et avec quel message.

---

## Vérification

1. Sur votre téléphone, ouvrez ArtisanPro → onglet **Notifications** (cloche en haut)
2. Touchez **« Activer les notifications »** → autorisez
3. Demandez à un ouvrier (ou un 2ᵉ appareil) de vous envoyer un message
4. Vous devez recevoir la notification, **même app fermée** 🎉

---

## En cas de souci

- **Aucune notification** : vérifiez que l'abonnement est actif (bandeau vert
  « Notifications activées » dans l'onglet Notifications).
- **iPhone** : la PWA doit être **installée sur l'écran d'accueil** (les push web
  ne marchent pas dans Safari onglet — uniquement en app installée, iOS 16.4+).
- **Logs** : Supabase → Edge Functions → notify → Logs pour voir les envois.
