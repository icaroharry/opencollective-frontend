import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';
import { Flex, Box } from '@rebass/grid';

import { Router } from '../server/pages';
import { CollectiveType } from '../lib/constants/collectives';
import { ssrNotFoundError } from '../lib/nextjs_utils';
import { withUser } from '../components/UserProvider';
import ErrorPage, { generateError } from '../components/ErrorPage';
import Loading from '../components/Loading';
import CollectiveThemeProvider from '../components/CollectiveThemeProvider';
import Container from '../components/Container';
import CollectiveNavbar from '../components/CollectiveNavbar';
import Page from '../components/Page';
import { H1, P, H4 } from '../components/Text';
import { FormattedMessage } from 'react-intl';
import StyledButton from '../components/StyledButton';
import StyledTag from '../components/StyledTag';
import { withRouter } from 'next/router';
import Link from '../components/Link';
import ConversationsList from '../components/conversations/ConversationsList';
import MessageBox from '../components/MessageBox';
import { Sections } from '../components/collective-page/_constants';
import PageFeatureNotSupported from '../components/PageFeatureNotSupported';
import hasFeature, { FEATURES } from '../lib/allowed-features';

/**
 * The main page to display collectives. Wrap route parameters and GraphQL query
 * to render `components/collective-page` with everything needed.
 */
class ConversationsPage extends React.Component {
  static getInitialProps({ query: { collectiveSlug, tag } }) {
    return { collectiveSlug, tag };
  }

  static propTypes = {
    /** @ignore from getInitialProps */
    collectiveSlug: PropTypes.string.isRequired,
    /** @ignore from getInitialProps */
    tag: PropTypes.string,
    /** @ignore from apollo */
    data: PropTypes.shape({
      loading: PropTypes.bool,
      error: PropTypes.any,
      Collective: PropTypes.shape({
        name: PropTypes.string.isRequired,
        description: PropTypes.string,
        type: PropTypes.string.isRequired,
        twitterHandle: PropTypes.string,
        imageUrl: PropTypes.string,
        canContact: PropTypes.bool,
        conversations: PropTypes.shape({
          nodes: PropTypes.arrayOf(PropTypes.object),
        }).isRequired,
      }),
    }).isRequired, // from withData
  };

  getPageMetaData(collective) {
    if (collective) {
      return { title: `${collective.name}'s conversations` };
    } else {
      return { title: 'Conversations' };
    }
  }

  resetTag = () => {
    const { collectiveSlug } = this.props;
    Router.pushRoute('conversations', { collectiveSlug });
  };

  render() {
    const { collectiveSlug, data } = this.props;

    if (!data.loading) {
      if (!data || data.error) {
        return <ErrorPage data={data} />;
      } else if (!data.Collective) {
        ssrNotFoundError(); // Force 404 when rendered server side
        return <ErrorPage error={generateError.notFound(collectiveSlug)} log={false} />;
      } else if (data.Collective.type !== CollectiveType.COLLECTIVE) {
        return <ErrorPage error={generateError.badCollectiveType()} log={false} />;
      } else if (!hasFeature(data.Collective, FEATURES.CONVERSATIONS)) {
        return <PageFeatureNotSupported />;
      }
    }

    const collective = data && data.Collective;
    return (
      <Page collective={collective} {...this.getPageMetaData(collective)} withoutGlobalStyles>
        {data.loading ? (
          <Container borderTop="1px solid #E8E9EB">
            <Loading />
          </Container>
        ) : (
          <CollectiveThemeProvider collective={data.Collective}>
            <Container borderTop="1px solid #E8E9EB">
              <CollectiveNavbar collective={data.Collective} selected={Sections.CONVERSATIONS} />
              <Container py={[4, 5]} px={[2, 3, 4]}>
                <Container maxWidth={1200} m="0 auto">
                  <H1 fontSize="H2" fontWeight="normal" textAlign="left" mb={2}>
                    <FormattedMessage id="conversations" defaultMessage="Conversations" />
                  </H1>
                  <Flex flexWrap="wrap" alignItems="center" mb={4} pr={2} justifyContent="space-between">
                    <P color="black.700" css={{ flex: '0 1 70%' }}>
                      <FormattedMessage
                        id="conversations.subtitle"
                        defaultMessage="Let’s get the ball rolling! This is where things get planned and sometimes this is where things get done. Ask questions, thank people for their efforts, and contribute your skills to the service of the community."
                      />
                    </P>
                    <Flex flex="0 0 300px" flexWrap="wrap">
                      <StyledButton buttonStyle="secondary" minWidth={100} m={2} disabled>
                        <FormattedMessage id="actions.follow" defaultMessage="Follow" />
                      </StyledButton>
                      <Link route="create-conversation" params={{ collectiveSlug }}>
                        <StyledButton buttonStyle="primary" m={2}>
                          <FormattedMessage id="conversations.create" defaultMessage="Create conversation" />
                        </StyledButton>
                      </Link>
                    </Flex>
                  </Flex>
                  <Flex flexDirection={['column-reverse', null, 'row']} justifyContent="space-between">
                    <Box mr={[null, null, null, 5]} flex="1 1 73%">
                      {collective.conversations.nodes.length > 0 ? (
                        <ConversationsList
                          collectiveSlug={collectiveSlug}
                          conversations={collective.conversations.nodes}
                        />
                      ) : (
                        <div>
                          {this.props.tag && (
                            <MessageBox mb={4} type="info" withIcon>
                              <FormattedMessage
                                id="conversations.noMatch"
                                defaultMessage="No conversation matching the given criterias."
                              />
                            </MessageBox>
                          )}
                          <Link route="create-conversation" params={{ collectiveSlug }}>
                            <StyledButton buttonStyle="primary" buttonSize="large">
                              <FormattedMessage
                                id="conversations.createFirst"
                                defaultMessage="Start a new conversation"
                              />
                            </StyledButton>
                          </Link>
                        </div>
                      )}
                    </Box>
                    <Box mb={3} flex="1 1 27%">
                      {collective.conversationsTags.length > 0 && (
                        <React.Fragment>
                          <H4 px={2} mb={3}>
                            <FormattedMessage id="Tags" defaultMessage="Tags" />
                          </H4>
                          <Flex flexWrap="wrap">
                            {collective.conversationsTags.map(({ tag }) => (
                              <Box key={tag} m={2}>
                                {tag === this.props.tag ? (
                                  <StyledTag type="info" closeButtonProps={{ onClick: this.resetTag }}>
                                    {tag}
                                  </StyledTag>
                                ) : (
                                  <Link route="conversations" params={{ collectiveSlug, tag }}>
                                    <StyledTag>{tag}</StyledTag>
                                  </Link>
                                )}
                              </Box>
                            ))}
                          </Flex>
                        </React.Fragment>
                      )}
                    </Box>
                  </Flex>
                </Container>
              </Container>
            </Container>
          </CollectiveThemeProvider>
        )}
      </Page>
    );
  }
}

const getCollective = graphql(
  gql`
    query Conversations($collectiveSlug: String!, $tag: String) {
      Collective(slug: $collectiveSlug, throwIfMissing: false) {
        id
        slug
        path
        name
        type
        canContact
        description
        settings
        imageUrl
        twitterHandle
        isIncognito
        conversations(tag: $tag) {
          nodes {
            id
            title
            summary
            createdAt
            tags
            fromCollective {
              id
              name
              type
              slug
              imageUrl
            }
          }
        }
        conversationsTags {
          id
          tag
        }
      }
    }
  `,
);

export default withUser(getCollective(withRouter(ConversationsPage)));
