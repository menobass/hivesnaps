/**
 * Snap Posting Service
 * Handles posting snaps to the Hive blockchain with beneficiaries for video content
 */

import { Client, PrivateKey, Operation } from '@hiveio/dhive';

interface PostSnapOptions {
  parentAuthor: string;
  parentPermlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  jsonMetadata: string;
  hasVideo?: boolean; // 10% beneficiary
  hasAudio?: boolean; // 5% beneficiary
}

/**
 * Posts a snap to the Hive blockchain
 * Adds beneficiaries based on media type:
 * - Video: 10% to @snapie
 * - Audio: 5% to @snapie
 *
 * @param client - Hive blockchain client
 * @param options - Posting options
 * @param postingKey - User's posting key (PrivateKey)
 * @returns Transaction ID
 */
export async function postSnapWithBeneficiaries(
  client: Client,
  options: PostSnapOptions,
  postingKey: PrivateKey
): Promise<string> {
  const { parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata, hasVideo, hasAudio } =
    options;

  // Base comment operation
  const commentOp: Operation = [
    'comment',
    {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author: author,
      permlink: permlink,
      title: title,
      body: body,
      json_metadata: jsonMetadata,
    },
  ];

  // Determine beneficiary weight based on media type
  let beneficiaryWeight: number | null = null;
  
  if (hasVideo) {
    beneficiaryWeight = 1000; // 10% for video
  } else if (hasAudio) {
    beneficiaryWeight = 500; // 5% for audio
  }

  // If no beneficiary needed, just broadcast the comment
  if (beneficiaryWeight === null) {
    const result = await client.broadcast.comment(
      {
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        author: author,
        permlink: permlink,
        title: title,
        body: body,
        json_metadata: jsonMetadata,
      },
      postingKey
    );
    return result.id || 'unknown';
  }

  // Add comment_options with beneficiaries
  const beneficiaries = [
    {
      account: 'snapie',
      weight: beneficiaryWeight,
    },
  ];

  const commentOptionsOp: Operation = [
    'comment_options',
    {
      author: author,
      permlink: permlink,
      max_accepted_payout: '1000000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: [
        [
          0,
          {
            beneficiaries,
          },
        ],
      ],
    },
  ];

  // Broadcast both operations together in a single transaction
  const result = await client.broadcast.sendOperations(
    [commentOp, commentOptionsOp] as Operation[],
    postingKey
  );

  return result.id || 'unknown';
}
