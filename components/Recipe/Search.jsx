// Search.js

import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Import icons from Expo

const Search = ({ searchQuery, onChangeText, onCancel }) => {
  return (
    <View style={styles.searchContainer}>
      <TextInput
        placeholder="Search for recipes..."
        value={searchQuery}
        onChangeText={onChangeText}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never" // Disable default clear button
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Ionicons name="close-circle" size={24} color="black" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 15,
    marginRight: 10,
  },
  cancelButton: {
    padding: 10,
  },
});

export default Search;
