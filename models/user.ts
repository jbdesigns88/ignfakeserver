import { Model, DataTypes, Optional } from 'sequelize';



// User attributes interface
interface UserAttributes {
  id: number;
  name: string;
  email: string;
}

// Interface for optional attributes during user creation (e.g., `id` is optional since it's auto-incremented)
interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}
let sequelize;
// User model class extending Sequelize's Model
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public name!: string;
  public email!: string;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the User model
User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
  },
  {
    sequelize, // passing the `sequelize` instance
    tableName: 'users',
  }
);

export default User;
