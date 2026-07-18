export const cursorPagination = async ({
  model,
  baseQuery,
  cursorId,
  cursorCreatedAt,
  limit = 10,
  sort = { createdAt: -1, _id: -1 },
  populate = [],
}) => {
  const maxLimit = Math.min(50, Number(limit));

  let cursorQuery = {};

  if (cursorId && cursorCreatedAt) {
    cursorQuery = {
      $or: [
        {
          createdAt: {
            $lt: new Date(cursorCreatedAt),
          },
        },
        {
          createdAt: new Date(cursorCreatedAt),
          _id: { $lt: cursorId },
        },
      ],
    };
  }

  const finalQuery =
    cursorId && cursorCreatedAt
      ? { $and: [baseQuery, cursorQuery] }
      : baseQuery;

  let query = model
    .find(finalQuery)
    .sort(sort)
    .limit(maxLimit + 1);

  for (const item of populate) {
    query = query.populate(item.path, item.select);
  }

  const data = await query.lean();

  const hasMore = data.length > maxLimit;

  if (hasMore) {
    data.pop();
  }

  let nextCursor = null;

  if (data.length) {
    const last = data[data.length - 1];

    nextCursor = {
      createdAt: last.createdAt,
      _id: last._id,
    };
  }

  return {
    data,
    nextCursor,
    hasMore,
  };
};
