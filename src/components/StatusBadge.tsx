import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'paid' | string | null | undefined;

function getStyle(status: PaymentStatus) {
  switch (status) {
    case 'approved':
      return { bg: '#DCFCE7', fg: '#166534', label: '已批核' };
    case 'paid':
      return { bg: '#DBEAFE', fg: '#1D4ED8', label: '已撥款' };
    case 'rejected':
      return { bg: '#FEE2E2', fg: '#991B1B', label: '被拒絕' };
    case 'pending':
    default:
      return { bg: '#F3F4F6', fg: '#374151', label: '待審批' };
  }
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = getStyle(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}> 
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '900',
  },
});
