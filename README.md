# jauge-conso

Une barre au-dessus de la zone de message de Claude Code (terminal et app desktop) qui montre tes limites d'usage d'abonnement :

- **5 h** et **Semaine** : une jauge en dégradé chaud (crème → or → orange → braise) du pourcentage déjà consommé ;
- **✓ tu tiendras** / **⚠ à ce rythme, limite vers HH:MM** : projection à ton rythme moyen depuis le début de la fenêtre ;
- **remise dans …** : compte à rebours avant la remise à zéro ;
- le coût indicatif de la session (équivalent API, inclus dans le forfait) ;
- une alerte unique par fenêtre quand tu passes 80 % ou que le rythme devient trop rapide.

Les limites n'apparaissent qu'avec un abonnement Claude (Pro / Max), après la première réponse de la session.

## Installation

Dans une session Claude Code en terminal :

```
/plugin install jauge-conso --marketplace zepur3/jauge-conso
```

Réponds `y` pour ajouter la marketplace, puis choisis la portée « user » pour l'avoir dans toutes tes sessions (app desktop comprise).

Ou en ligne de commande :

```
claude plugin install jauge-conso --marketplace zepur3/jauge-conso
```
