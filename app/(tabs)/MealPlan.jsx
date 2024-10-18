// MealPlan.js

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Header from './../Header';
import WeeklyMeals from '../../components/Meal_plan/WeeklyMeals';

export default function MealPlan() {
    return (
        <View style={styles.container}>
            {/* Header */}
            <Header title="Meal Plan" />

            {/* Meal Plan */}
            <WeeklyMeals />
        </View>
    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F8FF',
    },
});
