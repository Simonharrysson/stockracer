create extension if not exists "pg_net" with schema "extensions";

alter table "public"."symbols" alter column "exchange" set not null;


