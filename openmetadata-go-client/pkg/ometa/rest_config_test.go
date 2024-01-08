package ometa_test

import (
	"testing"

	"github.com/open-metadata/OpenMetadata/openmetadata-go-client/pkg/ometa"
	"github.com/stretchr/testify/assert"
)

func TestDefaultNew(t *testing.T) {
	var restConfig *ometa.RestConfig
	restConfig = ometa.NewRestConfig(
		"http://localhost:8080",
		"",
		0,
		0,
		nil,
		"myFakeAccessToken",
	)

	assert.Equal(t, restConfig.APIVersion, "v1", "apiVersion should be v1")
	assert.Equal(t, restConfig.Retry, int8(3), "retry should be 3")
	assert.Equal(t, restConfig.RetryWait, int16(30), "retryWait should be 30")
	assert.Equal(t, restConfig.RetryCodes, []int{429, 504}, "retryCodes should be [429, 504]")
	assert.Equal(t, restConfig.AuthTokenMode, "Bearer", "authTokenMode should be Bearer")
}

func TestCustomNew(t *testing.T) {
	var restConfig *ometa.RestConfig
	restConfig = ometa.NewRestConfig(
		"http://localhost:8080",
		"v2",
		10,
		60,
		[]int{429, 504, 500},
		"myFakeAccessToken",
	)

	assert.Equal(t, restConfig.APIVersion, "v2", "apiVersion should be v2")
	assert.Equal(t, restConfig.Retry, int8(10), "retry should be 10")
	assert.Equal(t, restConfig.RetryWait, int16(60), "retryWait should be 60")
	assert.Equal(t, restConfig.RetryCodes, []int{429, 504, 500}, "retryCodes should be [429, 504, 500]")
	assert.Equal(t, restConfig.AuthTokenMode, "Bearer", "authTokenMode should be Basic")
}
