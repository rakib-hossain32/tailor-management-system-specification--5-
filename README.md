# TailorPro — লোকাল সেটআপ

বাংলা tailor management app: customer ও family measurement profiles, order pipeline, worker tasks/QC, payment, inventory, appointment এবং customer portal।

## প্রথমবার চালানো

Node.js 22 বা নতুন LTS version এবং প্রথম install-এর জন্য internet লাগবে। Windows x64-এ আলাদা PostgreSQL installer বা Docker প্রয়োজন নেই; npm dependency থেকেই PostgreSQL binaries আসে।

প্রজেক্ট folder-এ terminal খুলে চালাও:

```powershell
npm install
npm run setup
npm run dev
```

সাইট: **http://localhost:3000**  
Database readiness: **http://localhost:3000/api/health**

`setup` একটি random database password ও session secret দিয়ে `.env.local` তৈরি করে, `127.0.0.1:5432`-এ PostgreSQL চালায়, `app_db` তৈরি করে, migration ও demo seed চালায়। আগে থেকে থাকা `.env` এবং cloud database বদলায় না। আগে থেকে থাকা `.env.local`-ও overwrite হয় না।

## Demo login

Staff login: **http://localhost:3000/staff-login**

| Account | Email | Password |
|---|---|---|
| Admin / owner | admin@rahimantailors.com | admin123 |
| Worker | worker@rahimantailors.com | worker123 |
| Manager | manager@rahimantailors.com | manager123 |
| Reception | reception@rahimantailors.com | reception123 |
| Master / QC | master@rahimantailors.com | master123 |

Customer portal: **http://localhost:3000/login**, demo phone **01712345678**। Development demo mode-এ OTP form-এ code দেখানো হয়। Worker account শুধু তার সঙ্গে যুক্ত worker profile-এর tasks ও earnings দেখতে পারে।

## পরেরবার চালানো

```powershell
npm run db:start
npm run dev
```

অ্যাপ বন্ধ করতে তার terminal-এ Ctrl+C। Database বন্ধ করতে:

```powershell
npm run db:stop
```

Database data `.local/postgres/`-এ থাকে এবং stop/start-এর পরও সংরক্ষিত থাকে। `npm run setup` আবার চালানো যায়; complete demo seed থাকলে সেটি আর insert করে না।

কোনো managed terminal background process বন্ধ করে দিলে `npm run db:start -- --foreground` দিয়ে database-এর terminal খোলা রাখো, এবং অন্য terminal-এ `npm run dev` চালাও।

## Command reference

| Command | কাজ |
|---|---|
| `npm run setup` | Local environment, database, migration ও seed |
| `npm run db:start` / `db:stop` / `db:status` | এই প্রজেক্টের PostgreSQL চালানো/বন্ধ/অবস্থা |
| `npm run db:generate -- --name=your_change` | Schema পরিবর্তন থেকে SQL migration তৈরি |
| `npm run db:migrate` | Checked-in migrations apply |
| `npm run db:push` | Development database-এ সরাসরি schema sync |
| `npm run db:seed` | Demo data initialize / safe completeness check |
| `npm run check` | ESLint ও TypeScript |
| `npm run build` | Production build |
| `npm run start` | Build করা app চালানো |
| `npm run test:integration` | চলমান local development app-এ HTTP/database smoke checks |

Integration checks শুধু loopback database ও `LOCAL_DEMO_MODE=true` configuration-এ চলে। এগুলো test records তৈরি করে এবং শেষে সেগুলোই মুছে দেয়।

## Environment ও নিজের PostgreSQL

App ও scripts একই precedence অনুসরণ করে: process environment → `.env.local` → `.env`। `.env.example`-এ প্রয়োজনীয় variable আছে।

নিজের PostgreSQL ব্যবহার করতে `.env.local`-এ তার `DATABASE_URL` এবং অন্তত ৩২ অক্ষরের random `AUTH_SECRET` দাও, তারপর `npm run db:migrate`। Demo চাইলে `npm run db:seed`। `db:start` শুধু এই প্রজেক্টের bundled cluster পরিচালনা করে।

Port 5432 অন্য কোনো service ব্যবহার করলে প্রথম setup-এর আগে:

```powershell
$env:LOCAL_DB_PORT = "5433"
npm run setup
```

আগে setup করা থাকলে `.env.local`-এ `DATABASE_URL`-এর port বদলে `npm run db:stop` তারপর `npm run db:start`।

Random session secret তৈরি:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## আসল SMS / OTP

`LOCAL_DEMO_MODE=true` এবং development mode থাকলেই OTP code browser-এ দেখানো হয়। Production-এ demo code বা demo login shortcuts দেখানো হয় না।

নিজের SMS provider-এর HTTP adapter চালু করতে:

```env
LOCAL_DEMO_MODE=false
SMS_WEBHOOK_URL=https://your-sms-adapter.example/send
SMS_WEBHOOK_TOKEN=your-private-adapter-token
```

Adapter-এ `POST` request যায়, `Authorization: Bearer <token>` header এবং JSON body: `{ to, message, code, expires_in_seconds }`। Successful delivery acceptance-এর জন্য 2xx response দিতে হবে। Provider configure না থাকলে real OTP request স্পষ্ট service-unavailable response দেয়।

OTP এবং rate limits একটি app process-এর memory-তে থাকে। একাধিক app instance চালালে shared Redis/database store যোগ করতে হবে।

## Data ও permissions

Staff login নতুন account নিজে থেকে বানায় না। Admin/manager worker form-এর login fields দিয়ে account ও profile একসঙ্গে তৈরি করতে পারে। Sensitive settings, worker management, expenses ও payroll owner/manager-এর জন্য; QC owner/manager/master-এর জন্য।

Payment retry একই idempotency key ও payload দিলে আগের receipt ফেরত দেয়। ভিন্ন payload একই key-তে বা বকেয়ার চেয়ে বেশি payment গ্রহণ করা হয় না। মজুরি QC pass হওয়ার পর earned হিসাবে ধরা হয়।

Demo seed অসম্পূর্ণ বা পুরনো unmanaged data পেলে সেটি overwrite না করে থামে। `npm run db:seed -- --force` সম্পূর্ণ configured database-এর business data মুছে পুনরায় demo data বসায়; এটি কেবল disposable demo database-এর জন্য। এই setup workflow কখনও নিজে থেকে `--force` চালায় না।

## Local files

`.env*`, `.local/`, `node_modules/`, `.next/` Git থেকে বাদ। `.env.example`, SQL migrations, package lock এবং `public/images/` project files হিসেবে রাখা হয়েছে। Public Bengali fonts Google Fonts থেকে আসে; internet না থাকলে system fallback fonts ব্যবহৃত হয়।
