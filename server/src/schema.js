import { GraphQLError } from 'graphql';
import { pool, DEFAULT_STEPS, mapRelease } from './db.js';
export const typeDefs = `#graphql
  enum ReleaseStatus { planned ongoing done }
  type Step { index: Int!, label: String!, completed: Boolean! }
  type Release { id: ID!, name: String!, date: String!, status: ReleaseStatus!, additionalInfo: String!, completedSteps: [Int!]!, steps: [Step!]!, createdAt: String!, updatedAt: String! }
  input CreateReleaseInput { name: String!, date: String!, additionalInfo: String }
  input UpdateReleaseInput { name: String, date: String, additionalInfo: String }
  type Query { releases: [Release!]!, release(id: ID!): Release, steps: [String!]! }
  type Mutation {
    createRelease(input: CreateReleaseInput!): Release!
    updateRelease(id: ID!, input: UpdateReleaseInput!): Release!
    setStepCompleted(id: ID!, stepIndex: Int!, completed: Boolean!): Release!
    deleteRelease(id: ID!): Boolean!
  }
`;
const getById = async (id) => {
  if (!/^\d+$/.test(String(id))) throw new GraphQLError('Invalid release id', { extensions: { code: 'BAD_USER_INPUT' } });
  const { rows } = await pool.query('SELECT * FROM releases WHERE id = $1', [id]);
  return rows[0] ? mapRelease(rows[0]) : null;
};
const requireRelease = async id => {
  const release = await getById(id);
  if (!release) throw new GraphQLError('Release not found', { extensions: { code: 'NOT_FOUND' } });
  return release;
};
export const resolvers = {
  Query: {
    releases: async () => { const { rows } = await pool.query('SELECT * FROM releases ORDER BY due_date ASC, id ASC'); return rows.map(mapRelease); },
    release: async (_, { id }) => getById(id),
    steps: () => DEFAULT_STEPS
  },
  Mutation: {
    createRelease: async (_, { input }) => {
      const name = String(input.name || '').trim();
      if (!name) throw new GraphQLError('Name is required', { extensions: { code: 'BAD_USER_INPUT' } });
      if (name.length > 160) throw new GraphQLError('Name must be 160 characters or fewer', { extensions: { code: 'BAD_USER_INPUT' } });
      const date = new Date(input.date);
      if (!input.date || Number.isNaN(date.getTime())) throw new GraphQLError('A valid due date is required', { extensions: { code: 'BAD_USER_INPUT' } });
      const info = String(input.additionalInfo || '').trim();
      const { rows } = await pool.query('INSERT INTO releases(name, due_date, additional_info) VALUES ($1,$2,$3) RETURNING *', [name, date.toISOString(), info]);
      return mapRelease(rows[0]);
    },
    updateRelease: async (_, { id, input }) => {
      await requireRelease(id);
      const fields = []; const values = [];
      if (input.name !== undefined) { const name = String(input.name).trim(); if (!name || name.length > 160) throw new GraphQLError('Name must contain 1–160 characters', { extensions: { code: 'BAD_USER_INPUT' } }); values.push(name); fields.push(`name = $${values.length}`); }
      if (input.date !== undefined) { const date = new Date(input.date); if (Number.isNaN(date.getTime())) throw new GraphQLError('Invalid due date', { extensions: { code: 'BAD_USER_INPUT' } }); values.push(date.toISOString()); fields.push(`due_date = $${values.length}`); }
      if (input.additionalInfo !== undefined) { values.push(String(input.additionalInfo)); fields.push(`additional_info = $${values.length}`); }
      if (!fields.length) return requireRelease(id);
      values.push(id);
      const { rows } = await pool.query(`UPDATE releases SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
      return mapRelease(rows[0]);
    },
    setStepCompleted: async (_, { id, stepIndex, completed }) => {
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= DEFAULT_STEPS.length) throw new GraphQLError('Invalid step index', { extensions: { code: 'BAD_USER_INPUT' } });
      const current = await requireRelease(id);
      const set = new Set(current.completedSteps);
      completed ? set.add(stepIndex) : set.delete(stepIndex);
      const { rows } = await pool.query('UPDATE releases SET completed_steps = $1::integer[], updated_at = NOW() WHERE id = $2 RETURNING *', [[...set].sort((a,b)=>a-b), id]);
      return mapRelease(rows[0]);
    },
    deleteRelease: async (_, { id }) => {
      if (!/^\d+$/.test(String(id))) throw new GraphQLError('Invalid release id', { extensions: { code: 'BAD_USER_INPUT' } });
      const result = await pool.query('DELETE FROM releases WHERE id = $1', [id]);
      return result.rowCount > 0;
    }
  }
};
