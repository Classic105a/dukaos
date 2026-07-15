
REVOKE EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.business_id_from_sale(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.business_id_from_grn(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.business_id_from_po(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.business_id_from_sale(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.business_id_from_grn(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.business_id_from_po(uuid) TO authenticated, service_role;
