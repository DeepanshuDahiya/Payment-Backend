export function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    walletId: user.walletId,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}
