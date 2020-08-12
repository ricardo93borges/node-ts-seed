import { Transaction } from 'knex';
import { MySQLModel } from './mysql';
import { UserSources } from '../../enums';
import { provide } from 'injection';

export interface User {
  id: string;
  name: string;
  username: string;
  emailAddress: string;
  source: UserSources;
  createdAt: Date;
  updatedAt: Date;
}

@provide()
export class UserModel extends MySQLModel<User> {
  getTableName(): string {
    return 'users';
  }

  async getByEmailsWithSource(
    emails: string[],
    source: UserSources,
    trx?: Transaction
  ): Promise<User[]> {
    return await this.transactionable(trx)
      .whereIn('emailAddress', emails)
      .where('source', source);
  }
}
