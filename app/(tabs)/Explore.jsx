// Explore.js

import { View } from 'react-native';
import React from 'react';
import Header from './../Header';
import FilterModal from '../../components/TinderSwipe/FilterModal'; // Adjust path
import RecipeSwiper from '../../components/TinderSwipe/RecipeSwiper';

export default class Explore extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedMealTimes: [],
      selectedDietaryPreferences: [],
    };
  }

  handleFiltersChange = ({ selectedMealTimes, selectedDietaryPreferences }) => {
    this.setState({ selectedMealTimes, selectedDietaryPreferences });
  };

  render() {
    const { selectedMealTimes, selectedDietaryPreferences } = this.state;

    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <Header title="Explore" />
        {/* Filter Modal */}
        <FilterModal onFiltersChange={this.handleFiltersChange} />
        {/* Recipe Swiper */}
        <RecipeSwiper
          selectedMealTimes={selectedMealTimes}
          selectedDietaryPreferences={selectedDietaryPreferences}
        />
        {/* Tracking */}
      </View>
    );
  }
}
