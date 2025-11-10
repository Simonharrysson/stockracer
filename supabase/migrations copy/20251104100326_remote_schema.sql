drop extension if exists "pg_net";

alter table "public"."symbols" alter column "exchange" drop not null;


