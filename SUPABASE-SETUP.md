# Collegamento a Supabase (piano Free)

## 1. Creare le tabelle
1. Aprire il progetto Supabase `Gestione sostituzioni`.
2. Aprire **SQL Editor** > **New query**.
3. Copiare tutto il contenuto di `supabase/setup.sql` ed eseguire la query.

## 2. Creare gli account di accesso
La vecchia schermata di accesso locale è stata sostituita dall'autenticazione Supabase.
1. Aprire **Authentication** > **Users** > **Add user**.
2. Creare l'account del responsabile e gli eventuali account collaboratori, usando email e password.
3. In **Authentication** > **Providers** > **Email**, disattivare la conferma email solo se si desidera consentire l'accesso immediato agli account creati manualmente.
4. Per assegnare il ruolo amministratore, copiare l'UUID dell'utente dalla pagina Users e lanciare nel SQL Editor:

```sql
update public.profiles set role = 'admin' where id = 'UUID-DELL-UTENTE';
```

Gli altri account restano `collaborator`.

## 3. Pubblicare l'app
Il client usa già l'URL e la Publishable key del progetto. Se si preferisce configurare variabili d'ambiente, copiare `.env.example` in `.env` e compilare i due valori. La Publishable key è pubblica e può essere inclusa nel frontend; non inserire mai `service_role` o Secret key nell'app.

## 4. Primo accesso e trasferimento dati
Dopo aver eseguito lo SQL e creato almeno un utente, accedere all'app con email e password Supabase. Al primo accesso, se la tabella `app_state` è vuota, l'app copia nel database i dati già presenti nel localStorage di quel browser (docenti, orari, permessi e sostituzioni). Da quel momento le modifiche vengono salvate online e gli aggiornamenti vengono propagati agli altri browser autenticati.

**Importante:** il primo accesso per importare i dati deve essere effettuato dal browser che contiene i dati locali aggiornati. Prima di procedere, fare anche un'esportazione di sicurezza dalla sezione gestione dati dell'app.

## 5. Ruoli e sicurezza
Le tabelle hanno Row Level Security attiva. Solo utenti autenticati possono leggere o modificare lo stato condiviso. Ogni account può leggere il proprio profilo; il ruolo amministratore viene assegnato dal proprietario tramite SQL Editor. Tutti gli utenti autenticati condividono i dati della scuola, come previsto per il lavoro collaborativo.
