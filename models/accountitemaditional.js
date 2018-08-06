'use strict';
module.exports = (sequelize, DataTypes) => {
  var AccountItemAditional = sequelize.define('AccountItemAditional', {
    name: DataTypes.STRING,
    account_item_id: DataTypes.INTEGER
  }, {
  	timestamps: false,
    tableName: 'tbl_account_item_aditionals'
  });
  AccountItemAditional.associate = function(models) {
    AccountItemAditional.belongsTo(models.AccountItem, {
      onDelete: "CASCADE",
      foreignKey: 'account_item_id'
    });
  };
  return AccountItemAditional;
};