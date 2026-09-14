-- Adds Cashfree as a second supported payment gateway alongside Razorpay.
-- `gateway` records which one created a given order — existing rows default
-- to 'razorpay', since that is the only gateway that has ever created one.
-- `cf_payment_id` is Cashfree's equivalent of the existing razorpay_payment_id
-- column, kept separate rather than reusing that column so historical
-- Razorpay rows (and the code that reads them) stay untouched.
--
-- NOT YET APPLIED to the live database — run this in the Supabase SQL editor
-- (Claude's session cannot run schema-altering SQL against production
-- directly).

alter table payment_orders
  add column if not exists gateway text not null default 'razorpay' check (gateway in ('razorpay', 'cashfree'));

alter table payment_orders
  add column if not exists cf_payment_id text;
