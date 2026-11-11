# 2. Používateľské roly a oprávnenia

Roly sa preberajú z firemnej organizačnej štruktúry. Jedna osoba môže mať viac rolí (napr. manažér je zároveň zamestnanec).

| Rola | Čo môže robiť | Čo vidí |
|---|---|---|
| Zamestnanec | Vypĺňa prieskumy, posiela dotazníky kolegom, posiela a prijíma kudos, nahlasuje odpovede, požiada o kontakt z HR | Svoje odpovede, prijaté kudos, svoje body, výsledky a kroky zverejnené pre jeho tím, výsledky vlastných dotazníkov |
| Manažér tímu | Všetko ako zamestnanec + spúšťa prieskumy pre svoj tím, zaznamenáva kroky, odpovedá na komentáre, žiada HR o meno autora nahlásenej odpovede | Agregované výsledky svojho tímu a komentáre bez mena (od 5 respondentov); meno autora iba po schválení HR (6.6) |
| HR | Spravuje šablóny, okruhy otázok, tutoriál a gamifikáciu; posudzuje nahlásené odpovede; schvaľuje alebo zamieta žiadosti manažérov o meno autora; kontaktuje ľudí v ohrození | Agregované výsledky naprieč tímami, teplotná mapa, upozornenia, **databáza odpovedí s menami** (kap. 6), kudos ako podklad k povýšeniu |
| Vedenie pobočky | Spúšťa prieskumy pre pobočku, schvaľuje akčné plány | Agregované výsledky pobočky a jej tímov |
| Administrátor | Spravuje používateľov, roly, integrácie, nastavenia AI a bezpečnosti | Technické logy; nemá prístup k databáze odpovedí ani k menám |

| ID | Požiadavka | Priorita |
|---|---|---|
| ROL-01 | Systém podporuje roly podľa tabuľky vyššie a ich kombinácie (okrem obmedzení v A-11). | Must |
| ROL-02 | Oprávnenia sa odvodzujú od organizačnej štruktúry (tím, pobočka, nadriadený) a automaticky sa aktualizujú pri zmene. | Must |
| ROL-03 | Manažér nevidí výsledky iných tímov, pokiaľ mu to HR výslovne nepovolí. | Must |
| ROL-04 | Okrem postupu v kapitole 6 nesmie žiadna rola (vrátane administrátora) zistiť autora odpovede cez UI, export, API ani databázu. | Must |
