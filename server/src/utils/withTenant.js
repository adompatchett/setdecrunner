// utils/withTenant.js
export function withTenant(handler) {
  return async (req, res, next) => {
    try {
      // attach the productionId to mongoose query options
      req.tenantOptions = { productionId: req.productionId };
      // also make it available during doc.save()
      // you can set on req for models to read (optional)
      await handler(req, res, next);
    } catch (e) { next(e); }
  };
}