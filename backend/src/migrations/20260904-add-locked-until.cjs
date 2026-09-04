'use strict'

const { DataTypes } = require('sequelize')

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (!tables.includes('usuarios')) return

    const columns = await queryInterface.describeTable('usuarios')
    if (!columns.locked_until) {
      await queryInterface.addColumn('usuarios', 'locked_until', {
        type: DataTypes.DATE,
        allowNull: true
      })
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (!tables.includes('usuarios')) return

    const columns = await queryInterface.describeTable('usuarios')
    if (columns.locked_until) {
      await queryInterface.removeColumn('usuarios', 'locked_until')
    }
  }
}