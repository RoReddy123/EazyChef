// components/BackArrow.jsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const BackArrow = ({ onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <View style={{ padding: 10 }}>
      <Text>Back</Text> 
    </View>
  </TouchableOpacity>
);

export default BackArrow;
