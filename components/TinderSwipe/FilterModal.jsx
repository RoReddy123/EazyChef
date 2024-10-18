// FilterModal.js

import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ScrollView } from 'react-native';

export default class FilterModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isFilterModalVisible: false,
      selectedMealTimes: [],
      selectedDietaryPreferences: [],
    };
  }

  showFilterModal = () => {
    this.setState({ isFilterModalVisible: true });
  };

  hideFilterModal = () => {
    this.setState({ isFilterModalVisible: false }, () => {
      // Pass the selected filters back to the parent component
      const { selectedMealTimes, selectedDietaryPreferences } = this.state;
      this.props.onFiltersChange({ selectedMealTimes, selectedDietaryPreferences });
    });
  };

  toggleMealTimeSelection = (mealTime) => {
    const { selectedMealTimes } = this.state;
    const index = selectedMealTimes.indexOf(mealTime);
    let newSelectedMealTimes = [...selectedMealTimes];

    if (index > -1) {
      // Meal time already selected, remove it
      newSelectedMealTimes.splice(index, 1);
    } else {
      // Add meal time
      newSelectedMealTimes.push(mealTime);
    }

    this.setState({ selectedMealTimes: newSelectedMealTimes });
  };

  toggleDietaryPreferenceSelection = (preference) => {
    const { selectedDietaryPreferences } = this.state;
    const index = selectedDietaryPreferences.indexOf(preference);
    let newSelectedDietaryPreferences = [...selectedDietaryPreferences];

    if (index > -1) {
      // Preference already selected, remove it
      newSelectedDietaryPreferences.splice(index, 1);
    } else {
      // Add preference
      newSelectedDietaryPreferences.push(preference);
    }

    this.setState({ selectedDietaryPreferences: newSelectedDietaryPreferences });
  };

  render() {
    const { isFilterModalVisible, selectedMealTimes, selectedDietaryPreferences } = this.state;
    const mealTimeItems = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const dietaryPreferenceItems = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free'];

    return (
      <View style={styles.filterContainer}>
        {/* Filter Button */}
        <TouchableOpacity onPress={this.showFilterModal} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Filter Recipes</Text>
        </TouchableOpacity>

        {/* Filter Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isFilterModalVisible}
          onRequestClose={this.hideFilterModal}
        >
          <View style={styles.filterModalContainer}>
            <View style={styles.filterModalContent}>
              <Text style={styles.filterModalTitle}>Filter Recipes</Text>
              <ScrollView>
                {/* Meal Times */}
                <Text style={styles.sectionTitle}>Meal Times</Text>
                {mealTimeItems.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.option,
                      selectedMealTimes.includes(item) && styles.optionSelected,
                    ]}
                    onPress={() => this.toggleMealTimeSelection(item)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedMealTimes.includes(item) && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Dietary Preferences */}
                <Text style={styles.sectionTitle}>Dietary Preferences</Text>
                {dietaryPreferenceItems.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.option,
                      selectedDietaryPreferences.includes(item) && styles.optionSelected,
                    ]}
                    onPress={() => this.toggleDietaryPreferenceSelection(item)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedDietaryPreferences.includes(item) && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.filterModalCloseButton}
                onPress={this.hideFilterModal}
              >
                <Text style={styles.filterModalCloseButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#F0F8FF',
  },
  filterButton: {
    backgroundColor: '#48d22b',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  filterModalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterModalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#48d22b',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  optionTextSelected: {
    color: '#fff',
  },
  filterModalCloseButton: {
    marginTop: 20,
    backgroundColor: '#48d22b',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  filterModalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
