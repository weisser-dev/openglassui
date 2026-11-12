import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeRepositoryLabel} from '../project-metadata.js';

test('repository labels omit credentials and query strings',()=>{
 assert.equal(safeRepositoryLabel('https://user:secret@example.com/team/project.git?token=secret'),'example.com/team/project');
 assert.equal(safeRepositoryLabel('git@example.com:team/project.git'),'example.com/team/project');
 assert.equal(safeRepositoryLabel('/private/project'),null);
});
