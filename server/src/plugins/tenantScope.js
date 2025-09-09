export function tenantScopePlugin(schema, { required = true } = {}) {
  if (!schema.paths.productionId) {
    schema.add({
      productionId: {
        type: schema.base.Schema.Types.ObjectId,
        ref: 'Production',
        required,
        index: true,
      }
    });
  }

  function scopeFilter(next) {
    const { productionId } = this.options;
    if (productionId) this.where({ productionId });
    next();
  }

  schema.pre('find', scopeFilter);
  schema.pre('findOne', scopeFilter);
  schema.pre('countDocuments', scopeFilter);
  schema.pre('findOneAndUpdate', scopeFilter);
  schema.pre('updateMany', scopeFilter);
  schema.pre('updateOne', scopeFilter);
  schema.pre('deleteMany', scopeFilter);
  schema.pre('deleteOne', scopeFilter);

  // inject on save
  schema.pre('save', function(next) {
    if (!this.productionId && this.$__.scopeProductionId) {
      this.productionId = this.$__.scopeProductionId;
    }
    next();
  });
}