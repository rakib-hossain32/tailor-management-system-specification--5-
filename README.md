# TailorPro — লোকাল সেটআপ

বাংলা tailor management app: customer ও family measurement profiles, order pipeline, worker tasks/QC, payment, inventory, appointment এবং customer portal।

## চালানো

Node.js 22 বা নতুন LTS version এবং প্রথম install-এর জন্য internet লাগবে। Windows x64-এ আলাদা PostgreSQL installer বা Docker প্রয়োজন নেই; npm dependency থেকেই PostgreSQL binaries আসে।

প্রজেক্টের `.env` বা `.env.local`-এ PostgreSQL সংযোগ আগে থেকেই থাকলে:

```powershell
npm install
npm run dev
```

সাইট: **http://localhost:3000**  
Database readiness: **http://localhost:3000/api/health**

নতুন bundled local PostgreSQL তৈরি করতে:

```powershell
npm install
npm run setup
npm run dev
```

`setup` শুধু loopback PostgreSQL-এ চলে। `.env.local` না থাকলে এটি random database password ও session secret দিয়ে local config তৈরি করে, `127.0.0.1:5432`-এ PostgreSQL চালায়, `app_db` তৈরি করে এবং schema ও প্রাথমিক shop/catalog configuration বসায়। এটি কোনো demo customer, order, worker বা hard-coded login তৈরি করে না। আগে থেকে থাকা `.env` বা `.env.local` overwrite হয় না; existing `.env.local`-এ remote URL থাকলে setup থেমে যায়।

## Staff login

Staff login: **http://localhost:3000/staff-login**। প্রথম setup-এ তৈরি owner account-এর credentials `.local/admin-credentials.json`-এ থাকে; ফাইলটি Git-এ রাখা হয় না। `ADMIN_EMAIL` ও `ADMIN_PASSWORD` আগে থেকে environment-এ দিলে initialization সেগুলো ব্যবহার করে। কোনো demo worker বা customer account স্বয়ংক্রিয়ভাবে তৈরি হয় না।

Customer portal: **http://localhost:3000/login**। Portal-এ ঢুকতে সক্রিয় customer account এবং configured SMS provider দরকার। Local OTP preview আলাদা করে `LOCAL_DEMO_MODE=true` দিয়ে চালু করা যায়; এতে demo customer বা order তৈরি হয় না।

## পরেরবার চালানো

```powershell
npm run db:start
npm run dev
```

অ্যাপ বন্ধ করতে তার terminal-এ Ctrl+C। Database বন্ধ করতে:

```powershell
npm run db:stop
```

Local database data `.local/postgres/`-এ থাকে এবং stop/start-এর পরও সংরক্ষিত থাকে। `npm run setup` local config ও database যাচাই করে; existing `.env.local` overwrite করে না।

কোনো managed terminal background process বন্ধ করে দিলে `npm run db:start -- --foreground` দিয়ে database-এর terminal খোলা রাখো, এবং অন্য terminal-এ `npm run dev` চালাও।

## Command reference

| Command | কাজ |
|---|---|
| `npm run setup` | Local environment, database, migration ও seed |
| `npm run db:start` / `db:stop` / `db:status` | এই প্রজেক্টের PostgreSQL চালানো/বন্ধ/অবস্থা |
| `npm run db:generate -- --name=your_change` | Schema পরিবর্তন থেকে SQL migration তৈরি |
| `npm run db:migrate` | Checked-in migrations apply |
| `npm run db:push` | Development database-এ সরাসরি schema sync |
| `npm run db:seed` | Schema-র ওপর নির্ভর করা প্রাথমিক shop/catalog configuration idempotently তৈরি |
| `npm run check` | ESLint ও TypeScript |
| `npm run build` | Production build |
| `npm run start` | Build করা app চালানো |
| `npm run test:integration` | চলমান local development app-এ HTTP/database smoke checks |

Integration checks শুধু loopback database ও `LOCAL_DEMO_MODE=true` configuration-এ চলে। এগুলো test records তৈরি করে এবং শেষে সেগুলোই মুছে দেয়।

## Environment ও নিজের PostgreSQL

App ও scripts একই precedence অনুসরণ করে: process environment → `.env.local` → `.env`। `.env.example`-এ প্রয়োজনীয় variable আছে।

নিজের PostgreSQL ব্যবহার করতে `.env.local`-এ তার `DATABASE_URL` এবং অন্তত ৩২ অক্ষরের random `AUTH_SECRET` দাও, তারপর `npm run db:migrate` এবং `npm run db:initialize` চালাও। Initialization schema-র দরকারি shop/catalog configuration যোগ করে; customer/order demo records যোগ করে না। `db:start` শুধু এই প্রজেক্টের bundled local cluster পরিচালনা করে।

## Cloudinary ছবি

Cloudinary Dashboard-এর **Product Environment Credentials** থেকে `.env` বা `.env.local`-এ নিচের server-side variable-গুলো বসাও:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

`.env.example`-এ placeholder আছে; সেগুলো বদলে আসল credential না দিলে image upload চালু হবে না। Credential বসানোর পর public image-গুলো Cloudinary-তে পাঠিয়ে database-এ URL সংরক্ষণ করতে:

```powershell
npm run media:sync
```

`.env`/`.env.local` git-এ commit কোরো না।

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

`db:seed` নিরাপদ initialization alias। এটি existing business data overwrite করে না; `--force` বন্ধ রাখা হয়েছে। Integration checks শুধু loopback database ও `LOCAL_DEMO_MODE=true`-তে চলে, test records তৈরি করে এবং শেষে সেগুলো মুছে দেয়।

## Local files

`.env*`, `.local/`, `node_modules/`, `.next/` Git থেকে বাদ। `.env.example`, SQL migrations, package lock এবং `public/images/` project files হিসেবে রাখা হয়েছে। Public Bengali fonts Google Fonts থেকে আসে; internet না থাকলে system fallback fonts ব্যবহৃত হয়।
