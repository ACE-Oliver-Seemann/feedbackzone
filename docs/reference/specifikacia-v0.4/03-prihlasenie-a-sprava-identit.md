# 3. Prihlásenie a správa identít

| ID | Požiadavka | Priorita |
|---|---|---|
| AUTH-01 | Prihlásenie výhradne firemným kontom cez Single Sign-On (OpenID Connect alebo SAML 2.0) voči firemnému poskytovateľovi identít (napr. Microsoft Entra ID). | Must |
| AUTH-02 | Viacfaktorové overenie podľa firemnej politiky; pre rolu HR vždy povinné (A-12). | Must |
| AUTH-03 | Automatické zakladanie a deaktivácia účtov (SCIM alebo synchronizácia z HR systému). Odchod zamestnanca = okamžitá strata prístupu. | Must |
| AUTH-04 | Načítanie atribútov: meno, e-mail, oddelenie, tím, pobočka, nadriadený, jazyk. | Must |
| AUTH-05 | **Prieskum na jeden klik:** odkaz z e-mailu alebo Teams otvorí prieskum bez ďalšieho prihlasovania (tiché SSO prihlásenie s existujúcou firemnou reláciou, prípadne jednorazový podpísaný odkaz s krátkou platnosťou viazaný na konkrétne kolo). | Must |
| AUTH-06 | Automatické odhlásenie po nečinnosti (napr. 30 min) a možnosť odhlásiť všetky relácie. | Should |
