'use strict'

const { DataTypes } = require('sequelize')

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (tables.includes('auditorias')) return

    await queryInterface.createTable(
      'auditorias',
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        usuario: { type: DataTypes.STRING(50), allowNull: true },
        usuario_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        rol: { type: DataTypes.STRING(20), allowNull: true },
        entidad: { type: DataTypes.STRING(50), allowNull: false },
        entidad_id: { type: DataTypes.STRING(64), allowNull: true },
        accion: { type: DataTypes.STRING(30), allowNull: false },
        descripcion: { type: DataTypes.STRING(500), allowNull: true },
        antes: { type: DataTypes.JSON, allowNull: true },
        despues: { type: DataTypes.JSON, allowNull: true },
        origen: {
          type: DataTypes.ENUM('manual', 'auto'),
          allowNull: false,
          defaultValue: 'manual'
        },
        ip: { type: DataTypes.STRING(45), allowNull: true },
        user_agent: { type: DataTypes.STRING(255), allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      },
      {
        indexes: [
          { name: 'idx_aud_created', fields: ['created_at'] },
          { name: 'idx_aud_entidad', fields: ['entidad', 'entidad_id'] },
          { name: 'idx_aud_usuario', fields: ['usuario'] },
          { name: 'idx_aud_accion', fields: ['accion'] },
          { name: 'idx_aud_origen', fields: ['origen'] }
        ]
      }
    )
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auditorias')
  }
}